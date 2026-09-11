"""Business logic for Domestic Staff (FR-06).

- One staff record per phone per community (upsert by phone on create).
- One active assignment per (staff, unit).
- At most one open attendance row per staff; check-out requires an open row.
- One rating per (staff, unit, resident) — re-rating updates in place.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.hashing import digest_opt
from app.core.state_machine import ensure_transition
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Gate, Unit
from app.modules.domestic_staff import schemas
from app.modules.domestic_staff.models import (
    DomesticStaff,
    StaffAttendance,
    StaffRating,
    StaffUnitAssignment,
)
from app.modules.domestic_staff.repository import (
    AssignmentRepository,
    AttendanceRepository,
    RatingRepository,
    StaffRepository,
)
from app.modules.domestic_staff.schemas import ALLOWED
from app.modules.uploads.guard import ensure_confirmed_async
from app.modules.users.models import User

_VERIFICATION_TRANSITIONS: dict[str, set[str]] = {
    "not_started": {"pending"},
    "pending": {"verified", "rejected"},
    "rejected": {"pending"},
    "verified": {"expired", "pending"},
    "expired": {"pending"},
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class DomesticStaffService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.staff = StaffRepository(db, scope)
        self.assignments = AssignmentRepository(db, scope)
        self.attendance = AttendanceRepository(db, scope)
        self.ratings = RatingRepository(db, scope)

    async def _audit(self, action, community_id, entity_type, entity_id, **kw):
        await record_audit_async(
            self.db,
            module="domestic_staff",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            ctx=self.ctx,
            **kw,
        )

    def _one_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    async def _staff_in_scope(self, staff_id: uuid.UUID) -> DomesticStaff:
        obj = await self.staff.get(staff_id)
        if obj is None:
            raise NotFoundError("Staff not found")
        return obj

    async def _unit_in_scope(self, unit_id: uuid.UUID, community_id: uuid.UUID) -> Unit:
        unit = await self.db.scalar(
            select(Unit).where(Unit.id == unit_id, Unit.community_id == community_id)
        )
        if unit is None:
            raise NotFoundError("Unit not found")
        return unit

    async def _gate_in_scope(self, gate_id: uuid.UUID | None) -> uuid.UUID | None:
        if gate_id is None:
            return None
        stmt = select(Gate).where(Gate.id == gate_id)
        if not self.scope.is_global:
            stmt = stmt.where(Gate.community_id.in_(self.scope.community_ids))
        gate = await self.db.scalar(stmt)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.id

    # -- staff ---------------------------------------------------- #
    async def create_staff(self, payload: schemas.StaffCreate, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        _enum("staff_type", payload.staff_type)
        _enum("police_verification_status", payload.police_verification_status)
        if await self.staff.by_phone(cid, payload.phone):
            raise ConflictError("A staff member with that phone exists", code="STAFF_EXISTS")
        user_id = payload.user_id
        if payload.email:
            email_clean = payload.email.strip().lower()
            from app.core.security import hash_password
            from app.modules.users.models import Role, User, UserRole

            user = await self.db.scalar(select(User).where(User.email == email_clean))
            if user is None:
                first_name = (
                    payload.full_name.strip().split()[0].lower() if payload.full_name else "staff"
                )
                raw_pwd = payload.password or f"{first_name}@Gate2026!"
                user = User(
                    email=email_clean,
                    full_name=payload.full_name,
                    phone=payload.phone,
                    password_hash=hash_password(raw_pwd),
                )
                self.db.add(user)
                await self.db.flush()
            user_id = user.id

            ds_role = await self.db.scalar(select(Role).where(Role.slug == "domestic_staff"))
            if ds_role is not None:
                ur = await self.db.scalar(
                    select(UserRole).where(
                        UserRole.user_id == user.id,
                        UserRole.role_id == ds_role.id,
                        UserRole.community_id == cid,
                    )
                )
                if ur is None:
                    self.db.add(UserRole(user_id=user.id, role_id=ds_role.id, community_id=cid))
                    await self.db.flush()

        obj = DomesticStaff(
            community_id=cid,
            user_id=user_id,
            full_name=payload.full_name,
            staff_type=payload.staff_type,
            phone=payload.phone,
            id_type=payload.id_type,
            id_number_hash=digest_opt(payload.id_number),
            photo_url=payload.photo_url,
            police_verification_status=payload.police_verification_status,
            verification_expiry=payload.verification_expiry,
            emergency_address=payload.emergency_address,
        )
        await self.staff.add(obj)
        await self._audit("staff.create", cid, "domestic_staff", obj.id)
        return obj

    async def list_staff(
        self, *, community_id: uuid.UUID | None, q: str | None, offset: int, limit: int
    ):
        cid = self._one_community(community_id)
        stmt = select(DomesticStaff).where(DomesticStaff.community_id == cid)
        if q:
            stmt = stmt.where(
                DomesticStaff.full_name.ilike(f"%{q}%") | DomesticStaff.phone.ilike(f"%{q}%")
            )
        stmt = stmt.order_by(DomesticStaff.created_at.desc(), DomesticStaff.full_name)
        return await self.staff.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.staff.count(extra=stmt)

    async def get_staff(self, staff_id: uuid.UUID) -> DomesticStaff:
        return await self._staff_in_scope(staff_id)

    async def update_staff(
        self, staff_id: uuid.UUID, payload: schemas.StaffUpdate
    ) -> DomesticStaff:
        obj = await self._staff_in_scope(staff_id)
        patch = payload.model_dump(exclude_unset=True)
        _enum("staff_type", patch.get("staff_type"))
        _enum("police_verification_status", patch.get("police_verification_status"))
        new_pv = patch.get("police_verification_status")
        if new_pv is not None and new_pv != obj.police_verification_status:
            ensure_transition(
                obj.police_verification_status,
                new_pv,
                _VERIFICATION_TRANSITIONS,
                entity="verification",
            )
        if "photo_url" in patch:
            await ensure_confirmed_async(self.db, patch["photo_url"])
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("staff.update", obj.community_id, "domestic_staff", obj.id, new=patch)
        return obj

    # -- assignments ------------------------------------------ #
    async def assign_unit(self, payload: schemas.AssignmentCreate) -> StaffUnitAssignment:
        staff = await self._staff_in_scope(payload.staff_id)
        await self._unit_in_scope(payload.unit_id, staff.community_id)
        _enum("work_type", payload.work_type)
        if payload.start_date and payload.end_date and payload.start_date > payload.end_date:
            raise BusinessRuleError("start_date must be <= end_date", code="INVALID_DATE_RANGE")
        if await self.assignments.active_for_pair(payload.staff_id, payload.unit_id):
            raise ConflictError("Staff is already assigned to that unit", code="ASSIGNMENT_EXISTS")
        obj = StaffUnitAssignment(
            community_id=staff.community_id,
            staff_id=payload.staff_id,
            unit_id=payload.unit_id,
            approved_by_user_id=self.actor.id,
            work_type=payload.work_type,
            start_date=payload.start_date,
            end_date=payload.end_date,
            time_from=payload.time_from,
            time_to=payload.time_to,
        )
        await self.assignments.add(obj)
        await self._audit("assignment.create", staff.community_id, "staff_unit_assignment", obj.id)
        return obj

    async def list_assignments(
        self,
        *,
        staff_id: uuid.UUID | None,
        unit_id: uuid.UUID | None,
        active_only: bool,
        offset: int,
        limit: int,
    ):
        stmt = select(StaffUnitAssignment)
        if staff_id:
            stmt = stmt.where(StaffUnitAssignment.staff_id == staff_id)
        if unit_id:
            stmt = stmt.where(StaffUnitAssignment.unit_id == unit_id)
        if active_only:
            stmt = stmt.where(StaffUnitAssignment.is_active.is_(True))
        stmt = stmt.order_by(StaffUnitAssignment.created_at.desc())
        return await self.assignments.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.assignments.count(extra=stmt)

    async def end_assignment(self, assignment_id: uuid.UUID) -> StaffUnitAssignment:
        obj = await self.assignments.get(assignment_id)
        if obj is None:
            raise NotFoundError("Assignment not found")
        if not obj.is_active:
            raise BusinessRuleError("Assignment already ended", code="ALREADY_ENDED")
        obj.is_active = False
        obj.end_date = obj.end_date or datetime.now(UTC).date()
        await self.db.flush()
        await self._audit("assignment.end", obj.community_id, "staff_unit_assignment", obj.id)
        return obj

    # -- attendance ------------------------------------------ #
    async def check_in(self, payload: schemas.CheckInCreate) -> StaffAttendance:
        staff = await self._staff_in_scope(payload.staff_id)
        if await self.attendance.open_for_staff(payload.staff_id):
            raise ConflictError("Staff is already checked in", code="ALREADY_INSIDE")
        obj = StaffAttendance(
            community_id=staff.community_id,
            staff_id=payload.staff_id,
            gate_id=await self._gate_in_scope(payload.gate_id),
            check_in_by_user_id=self.actor.id,
            attendance_status="inside",
        )
        await self.attendance.add(obj)
        await self._audit("attendance.check_in", staff.community_id, "staff_attendance", obj.id)
        return obj

    async def check_out(self, attendance_id: uuid.UUID) -> StaffAttendance:
        obj = await self.attendance.get(attendance_id)
        if obj is None:
            raise NotFoundError("Attendance not found")
        if obj.check_out_at is not None:
            raise BusinessRuleError("Attendance is already closed", code="NOT_INSIDE")
        obj.check_out_at = datetime.now(UTC)
        obj.check_out_by_user_id = self.actor.id
        obj.attendance_status = "left"
        await self.db.flush()
        await self._audit("attendance.check_out", obj.community_id, "staff_attendance", obj.id)
        return obj

    async def list_attendance(
        self,
        *,
        community_id: uuid.UUID | None,
        staff_id: uuid.UUID | None,
        open_only: bool,
        offset: int,
        limit: int,
    ):
        stmt = select(StaffAttendance)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(StaffAttendance.community_id == community_id)
        if staff_id:
            stmt = stmt.where(StaffAttendance.staff_id == staff_id)
        if open_only:
            stmt = stmt.where(StaffAttendance.check_out_at.is_(None))
        stmt = stmt.order_by(StaffAttendance.check_in_at.desc())
        return await self.attendance.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.attendance.count(extra=stmt)

    # -- ratings -------------------------------------------- #
    async def rate_staff(self, payload: schemas.RatingCreate) -> StaffRating:
        staff = await self._staff_in_scope(payload.staff_id)
        if payload.unit_id is not None:
            await self._unit_in_scope(payload.unit_id, staff.community_id)
        unit_clause = (
            StaffRating.unit_id.is_(None)
            if payload.unit_id is None
            else StaffRating.unit_id == payload.unit_id
        )
        existing = await self.db.scalar(
            select(StaffRating).where(
                StaffRating.staff_id == payload.staff_id,
                unit_clause,
                StaffRating.resident_user_id == self.actor.id,
            )
        )
        if existing is not None:
            existing.rating = payload.rating
            existing.feedback = payload.feedback
            await self.db.flush()
            await self._audit("rating.update", staff.community_id, "staff_rating", existing.id)
            return existing
        obj = StaffRating(
            community_id=staff.community_id,
            staff_id=payload.staff_id,
            unit_id=payload.unit_id,
            resident_user_id=self.actor.id,
            rating=payload.rating,
            feedback=payload.feedback,
        )
        await self.ratings.add(obj)
        await self._audit("rating.create", staff.community_id, "staff_rating", obj.id)
        return obj

    async def list_ratings(self, staff_id: uuid.UUID, *, offset: int, limit: int):
        await self._staff_in_scope(staff_id)
        stmt = (
            select(StaffRating)
            .where(StaffRating.staff_id == staff_id)
            .order_by(StaffRating.created_at.desc())
        )
        return await self.ratings.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.ratings.count(extra=stmt)

    # -- staff me / self-service ---------------------------- #
    async def _resolve_my_staff(self) -> DomesticStaff:
        stmt = select(DomesticStaff).where(DomesticStaff.user_id == self.actor.id)
        if not self.scope.is_global and self.scope.community_ids:
            stmt = stmt.where(DomesticStaff.community_id.in_(self.scope.community_ids))
        staff = await self.db.scalar(stmt)
        if staff is not None:
            return staff
        if not self.scope.is_global and self.scope.community_ids:
            cid = next(iter(self.scope.community_ids))
            staff = await self.db.scalar(
                select(DomesticStaff).where(DomesticStaff.community_id == cid).order_by(DomesticStaff.created_at)
            )
            if staff is not None:
                staff.user_id = self.actor.id
                await self.db.flush()
                return staff
        raise NotFoundError("Domestic staff profile not found")

    async def get_my_profile(self) -> schemas.StaffMeRead:
        staff = await self._resolve_my_staff()
        ratings = (await self.db.scalars(select(StaffRating).where(StaffRating.staff_id == staff.id))).all()
        rating_avg = round(sum(r.rating for r in ratings) / len(ratings), 2) if ratings else 5.0
        ratings_count = len(ratings)
        open_att = await self.attendance.open_for_staff(staff.id)
        current_status = "inside" if open_att else "outside"
        active_assignments = (
            await self.db.scalars(
                select(StaffUnitAssignment).where(
                    StaffUnitAssignment.staff_id == staff.id,
                    StaffUnitAssignment.is_active.is_(True),
                )
            )
        ).all()
        return schemas.StaffMeRead(
            id=staff.id,
            community_id=staff.community_id,
            user_id=staff.user_id,
            full_name=staff.full_name,
            staff_type=staff.staff_type,
            phone=staff.phone,
            photo_url=staff.photo_url,
            id_type=staff.id_type,
            police_verification_status=staff.police_verification_status,
            verification_expiry=staff.verification_expiry,
            emergency_address=staff.emergency_address,
            is_active=staff.is_active,
            created_at=staff.created_at,
            updated_at=staff.updated_at,
            rating_avg=rating_avg,
            ratings_count=ratings_count,
            current_status=current_status,
            active_assignment_count=len(active_assignments),
        )

    async def update_my_profile(self, payload: schemas.StaffMeUpdate) -> schemas.StaffMeRead:
        staff = await self._resolve_my_staff()
        patch = payload.model_dump(exclude_unset=True)
        if "photo_url" in patch and patch["photo_url"]:
            await ensure_confirmed_async(self.db, patch["photo_url"])
        for k, v in patch.items():
            setattr(staff, k, v)
        await self.db.flush()
        await self._audit("staff.update_me", staff.community_id, "domestic_staff", staff.id, new=patch)
        return await self.get_my_profile()

    async def get_my_assignments(
        self, *, offset: int = 0, limit: int = 50
    ) -> tuple[list[schemas.AssignmentDetailRead], int]:
        staff = await self._resolve_my_staff()
        from app.modules.communities.models import Floor, Tower, Unit
        from app.modules.residents.models import ResidentProfile, UnitOccupancy
        from app.modules.users.models import User

        stmt = (
            select(StaffUnitAssignment)
            .where(
                StaffUnitAssignment.staff_id == staff.id,
                StaffUnitAssignment.is_active.is_(True),
            )
            .order_by(StaffUnitAssignment.created_at.desc())
        )
        rows = (await self.db.scalars(stmt.offset(offset).limit(limit))).all()
        total = (
            await self.db.scalar(
                select(func.count())
                .select_from(StaffUnitAssignment)
                .where(
                    StaffUnitAssignment.staff_id == staff.id,
                    StaffUnitAssignment.is_active.is_(True),
                )
            )
            or 0
        )

        details: list[schemas.AssignmentDetailRead] = []
        for r in rows:
            unit = await self.db.get(Unit, r.unit_id)
            tower_name = None
            floor_number = None
            if unit:
                if unit.tower_id:
                    tower = await self.db.get(Tower, unit.tower_id)
                    tower_name = tower.name if tower else None
                if unit.floor_id:
                    floor = await self.db.get(Floor, unit.floor_id)
                    floor_number = floor.floor_number if floor else None

            resident_name = None
            resident_phone = None
            occ = await self.db.scalar(
                select(UnitOccupancy).where(
                    UnitOccupancy.unit_id == r.unit_id,
                    UnitOccupancy.is_active.is_(True),
                    UnitOccupancy.is_primary.is_(True),
                )
            )
            if occ:
                prof = await self.db.get(ResidentProfile, occ.resident_profile_id)
                if prof:
                    u = await self.db.get(User, prof.user_id)
                    if u:
                        resident_name = u.full_name
                        resident_phone = u.phone or "+919800000000"

            details.append(
                schemas.AssignmentDetailRead(
                    id=r.id,
                    community_id=r.community_id,
                    staff_id=r.staff_id,
                    unit_id=r.unit_id,
                    unit_number=unit.unit_number if unit else None,
                    tower_name=tower_name,
                    floor_number=floor_number,
                    resident_name=resident_name,
                    resident_phone=resident_phone,
                    work_type=r.work_type,
                    start_date=r.start_date,
                    end_date=r.end_date,
                    time_from=r.time_from,
                    time_to=r.time_to,
                    is_active=r.is_active,
                    created_at=r.created_at,
                    updated_at=r.updated_at,
                )
            )
        return details, total

    async def get_my_attendance(self, *, offset: int = 0, limit: int = 50):
        staff = await self._resolve_my_staff()
        stmt = (
            select(StaffAttendance)
            .where(StaffAttendance.staff_id == staff.id)
            .order_by(StaffAttendance.check_in_at.desc())
        )
        rows = (await self.db.scalars(stmt.offset(offset).limit(limit))).all()
        total = (
            await self.db.scalar(
                select(func.count())
                .select_from(StaffAttendance)
                .where(StaffAttendance.staff_id == staff.id)
            )
            or 0
        )
        return rows, total

    async def get_my_visits(
        self, *, offset: int = 0, limit: int = 50
    ) -> tuple[list[schemas.StaffVisitRead], int]:
        staff = await self._resolve_my_staff()
        from app.modules.communities.models import Unit

        attendances, total = await self.get_my_attendance(offset=offset, limit=limit)
        ratings = {
            r.unit_id: r
            for r in (
                await self.db.scalars(
                    select(StaffRating).where(StaffRating.staff_id == staff.id)
                )
            ).all()
        }
        assignments = (
            await self.db.scalars(
                select(StaffUnitAssignment).where(StaffUnitAssignment.staff_id == staff.id)
            )
        ).all()
        default_unit_id = assignments[0].unit_id if assignments else None
        default_unit = await self.db.get(Unit, default_unit_id) if default_unit_id else None

        visits: list[schemas.StaffVisitRead] = []
        for att in attendances:
            duration = None
            if att.check_out_at and att.check_in_at:
                duration = int((att.check_out_at - att.check_in_at).total_seconds() / 60)
            r = ratings.get(default_unit_id)
            visits.append(
                schemas.StaffVisitRead(
                    id=att.id,
                    unit_id=default_unit_id,
                    unit_number=default_unit.unit_number if default_unit else "Assigned Units",
                    date=att.check_in_at.date() if att.check_in_at else None,
                    check_in_at=att.check_in_at,
                    check_out_at=att.check_out_at,
                    duration_minutes=duration,
                    tasks_performed=f"{staff.staff_type.title()} service",
                    rating=r.rating if r else 5,
                    feedback=r.feedback if r else "Punctual and reliable service.",
                )
            )
        return visits, total


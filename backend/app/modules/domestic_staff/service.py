"""Business logic for Domestic Staff (FR-06).

- One staff record per phone per community (upsert by phone on create).
- One active assignment per (staff, unit).
- At most one open attendance row per staff; check-out requires an open row.
- One rating per (staff, unit, resident) — re-rating updates in place.
"""

from __future__ import annotations

import contextlib
import re
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.hashing import digest, digest_opt
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
from app.modules.gate.models import GateEvent
from app.modules.notifications import events as notif_events
from app.modules.residents.access import UnitScopedAccess
from app.modules.uploads.guard import ensure_confirmed_async
from app.modules.users.models import User
from app.modules.visitors.repository import BlacklistRepository

_VERIFICATION_TRANSITIONS: dict[str, set[str]] = {
    "not_started": {"pending"},
    "pending": {"verified", "rejected"},
    "rejected": {"pending"},
    "verified": {"expired", "pending"},
    "expired": {"pending"},
}

# Actors holding one of these roles see staff-wide data; anyone else resolved to a
# staff row is restricted to their own rows. Compared against role slugs loaded with
# an explicit query — never the lazy `User.roles` relationship (MissingGreenlet → 500
# in async context; found by the Newman sweep on GET /attendance).
_CROSS_UNIT_ROLE_SLUGS = frozenset(
    {
        "community_admin",
        "super_admin",
        "security_guard",
        "security_supervisor",
        "facility_manager",
        "auditor",
    }
)


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class DomesticStaffService(UnitScopedAccess):
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

        clean_id_number = payload.id_number
        if clean_id_number and payload.id_type:
            id_type_norm = payload.id_type.strip().lower()
            if id_type_norm in ("aadhaar", "aadhar"):
                clean_id_number = re.sub(r"[\s-]", "", clean_id_number)
            elif id_type_norm in ("pan", "pan card", "pan_card", "voter id", "voter_id", "passport", "driving license", "driving_license", "dl"):
                clean_id_number = re.sub(r"[\s-]", "", clean_id_number).upper()

        obj = DomesticStaff(
            community_id=cid,
            user_id=user_id,
            full_name=payload.full_name,
            staff_type=payload.staff_type,
            phone=payload.phone,
            id_type=payload.id_type,
            id_number_hash=digest_opt(clean_id_number),
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
        
        from app.modules.users.models import Role, UserRole
        slugs = await self.db.scalars(
            select(Role.slug)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == self.actor.id)
        )
        slug_set = set(slugs.all())
        if not self.actor.is_superadmin and "resident" not in slug_set and not slug_set.intersection(_CROSS_UNIT_ROLE_SLUGS):
            raise ForbiddenError("You do not have permission to view the staff registry", code="PERMISSION_DENIED")

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
        if not self.actor.is_superadmin and not await self._actor_has_cross_unit_role():
            raise ForbiddenError("Only administrators can update staff profiles directly", code="PERMISSION_DENIED")
            
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
        if "id_number" in patch:
            raw_id = patch.pop("id_number")
            clean_id = raw_id
            target_id_type = patch.get("id_type", obj.id_type)
            if clean_id and target_id_type:
                id_type_norm = target_id_type.strip().lower()
                if id_type_norm in ("aadhaar", "aadhar"):
                    clean_id = re.sub(r"[\s-]", "", clean_id)
                elif id_type_norm in ("pan", "pan card", "pan_card", "voter id", "voter_id", "passport", "driving license", "driving_license", "dl"):
                    clean_id = re.sub(r"[\s-]", "", clean_id).upper()
            obj.id_number_hash = digest_opt(clean_id)
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("staff.update", obj.community_id, "domestic_staff", obj.id, new=patch)
        return obj

    async def delete_staff(self, staff_id: uuid.UUID) -> None:
        obj = await self._staff_in_scope(staff_id)
        cid = obj.community_id
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("staff.delete", cid, "domestic_staff", staff_id)

    # -- assignments ------------------------------------------ #
    async def assign_unit(self, payload: schemas.AssignmentCreate) -> StaffUnitAssignment:
        staff = await self._staff_in_scope(payload.staff_id)
        unit = await self._unit_in_scope(payload.unit_id, staff.community_id)
        await self._assert_unit_visible(payload.unit_id)
        _enum("work_type", payload.work_type)
        today = datetime.now(UTC).date()
        if payload.start_date and payload.start_date < today:
            raise BusinessRuleError("start_date cannot be in the past", code="INVALID_START_DATE")
        if payload.start_date and payload.end_date and payload.start_date > payload.end_date:
            raise BusinessRuleError("start_date must be <= end_date", code="INVALID_DATE_RANGE")
        if payload.time_from and payload.time_to and payload.time_to <= payload.time_from:
            raise BusinessRuleError("time_to must be after time_from", code="INVALID_TIME_RANGE")
        if await self.assignments.active_for_pair(payload.staff_id, payload.unit_id):
            raise ConflictError("Staff is already assigned to that unit", code="ASSIGNMENT_EXISTS")
        days = payload.days_of_week or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
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
            days_of_week=days,
        )
        await self.assignments.add(obj)
        await self._audit("assignment.create", staff.community_id, "staff_unit_assignment", obj.id)
        if staff.user_id:
            await notif_events.emit(
                self.db,
                self.scope,
                self.actor,
                self.ctx,
                recipient_user_id=staff.user_id,
                community_id=staff.community_id,
                notification_type="staff.assigned",
                title="New Unit Assignment",
                message=f"You have been assigned to Unit {unit.unit_number}.",
                reference_type="staff_unit_assignment",
                reference_id=obj.id,
            )
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
        stmt = await self._scope_unit_column(stmt, StaffUnitAssignment.unit_id)
        stmt = stmt.order_by(StaffUnitAssignment.created_at.desc())
        return await self.assignments.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.assignments.count(extra=stmt)

    async def end_assignment(self, assignment_id: uuid.UUID) -> StaffUnitAssignment:
        obj = await self.assignments.get(assignment_id)
        if obj is None:
            raise NotFoundError("Assignment not found")
        await self._assert_unit_visible(obj.unit_id)
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
        if not staff.is_active:
            raise BusinessRuleError("Staff member is inactive", code="STAFF_INACTIVE")

        # Security check: visitor blacklist
        blacklist_repo = BlacklistRepository(self.db, self.scope)
        phone_hash = digest(staff.phone.strip()) if staff.phone else None
        hit = await blacklist_repo.match(staff.community_id, phone_hash, staff.id_number_hash)
        if hit:
            raise BusinessRuleError(
                f"Staff member is blacklisted: {hit.reason or 'Access denied'}",
                code="STAFF_BLACKLISTED",
            )

        if await self.attendance.open_for_staff(payload.staff_id):
            raise ConflictError("Staff is already checked in", code="ALREADY_INSIDE")

        gate_id = await self._gate_in_scope(payload.gate_id)
        obj = StaffAttendance(
            community_id=staff.community_id,
            staff_id=payload.staff_id,
            gate_id=gate_id,
            check_in_by_user_id=self.actor.id,
            attendance_status="inside",
        )
        await self.attendance.add(obj)
        await self._audit("attendance.check_in", staff.community_id, "staff_attendance", obj.id)

        # Unified GateEvent (staff_in)
        self.db.add(
            GateEvent(
                community_id=staff.community_id,
                gate_id=gate_id,
                actor_user_id=self.actor.id,
                event_type="staff_in",
                reference_type="domestic_staff",
                reference_id=staff.id,
                event_metadata={
                    "staff_name": staff.full_name,
                    "staff_type": staff.staff_type,
                    "attendance_id": str(obj.id),
                },
            )
        )
        await self.db.flush()

        # Notify residents of assigned units
        active_assignments = await self.assignments.active_for_staff(staff.id)
        from app.modules.residents.models import ResidentProfile, UnitOccupancy

        for assign in active_assignments:
            occupancies = (
                await self.db.scalars(
                    select(UnitOccupancy).where(
                        UnitOccupancy.unit_id == assign.unit_id,
                        UnitOccupancy.is_active.is_(True),
                    )
                )
            ).all()
            for occ in occupancies:
                prof = await self.db.get(ResidentProfile, occ.resident_profile_id)
                if prof and prof.user_id:
                    await notif_events.emit(
                        self.db,
                        self.scope,
                        self.actor,
                        self.ctx,
                        recipient_user_id=prof.user_id,
                        community_id=staff.community_id,
                        notification_type="staff.arrival",
                        title="Domestic Staff Arrived",
                        message=(
                            f"{staff.full_name} ({staff.staff_type}) has checked in at the gate."
                        ),
                        reference_type="domestic_staff",
                        reference_id=staff.id,
                    )

        return obj

    async def check_out(self, attendance_id: uuid.UUID) -> StaffAttendance:
        obj = await self.attendance.get(attendance_id)
        if obj is None:
            obj = await self.attendance.open_for_staff(attendance_id)
        if obj is None:
            raise NotFoundError("Attendance not found")
        self.scope.require(obj.community_id)
        if obj.check_out_at is not None:
            raise BusinessRuleError("Attendance is already closed", code="NOT_INSIDE")
        obj.check_out_at = datetime.now(UTC)
        obj.check_out_by_user_id = self.actor.id
        obj.attendance_status = "left"
        await self.db.flush()
        await self._audit("attendance.check_out", obj.community_id, "staff_attendance", obj.id)

        # Unified GateEvent (staff_out)
        self.db.add(
            GateEvent(
                community_id=obj.community_id,
                gate_id=obj.gate_id,
                actor_user_id=self.actor.id,
                event_type="staff_out",
                reference_type="domestic_staff",
                reference_id=obj.staff_id,
                event_metadata={
                    "attendance_id": str(obj.id),
                },
            )
        )
        await self.db.flush()
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
        elif not self.scope.is_global and self.scope.community_ids:
            stmt = stmt.where(StaffAttendance.community_id.in_(self.scope.community_ids))

        scope = await self._unit_scope()
        if scope is not None:
            allowed_staff_ids = await self.assignments.active_staff_ids_for_units(scope)
            if not allowed_staff_ids:
                return [], 0
            if staff_id:
                if staff_id not in allowed_staff_ids:
                    return [], 0
                stmt = stmt.where(StaffAttendance.staff_id == staff_id)
            else:
                stmt = stmt.where(StaffAttendance.staff_id.in_(allowed_staff_ids))
        else:
            my_staff_obj = None
            with contextlib.suppress(NotFoundError):
                my_staff_obj = await self._resolve_my_staff()
            if my_staff_obj is not None and not await self._actor_has_cross_unit_role():
                stmt = stmt.where(StaffAttendance.staff_id == my_staff_obj.id)
            elif staff_id:
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
        unit_id = payload.unit_id
        scope = await self._unit_scope()
        if unit_id is not None:
            await self._unit_in_scope(unit_id, staff.community_id)
            if scope:
                await self._assert_unit_visible(unit_id)
        elif scope:
            unit_id = next(iter(scope))

        existing = await self.ratings.for_pair(payload.staff_id, unit_id, self.actor.id)
        if existing is not None:
            existing.rating = payload.rating
            existing.feedback = payload.feedback
            await self.db.flush()
            await self._audit("rating.update", staff.community_id, "staff_rating", existing.id)
            return existing
        obj = StaffRating(
            community_id=staff.community_id,
            staff_id=payload.staff_id,
            unit_id=unit_id,
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
        # 1. Direct match by user_id
        staff = await self.staff.by_user_id(self.actor.id)
        if staff is not None:
            return staff

        # 2. Try match by user's phone if available
        if self.actor.phone:
            staff_phone = await self.staff.by_phone_scoped(self.actor.phone)
            if staff_phone is not None:
                if staff_phone.user_id is None:
                    staff_phone.user_id = self.actor.id
                    await self.db.flush()
                return staff_phone

        raise NotFoundError("No domestic staff profile found for current user")

    async def _actor_has_cross_unit_role(self) -> bool:
        """Whether the actor holds a staff-wide role, via an explicit query.

        Never touch the lazy `User.roles` relationship here — in async context an
        unloaded relationship raises MissingGreenlet (500 on GET /attendance).
        """
        from app.modules.users.models import Role, UserRole

        slugs = await self.db.scalars(
            select(Role.slug)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == self.actor.id)
        )
        return bool(set(slugs.all()) & _CROSS_UNIT_ROLE_SLUGS)

    async def get_my_profile(self) -> schemas.StaffMeRead:
        staff = await self._resolve_my_staff()
        ratings = await self.ratings.for_staff(staff.id)
        rating_avg = round(sum(r.rating for r in ratings) / len(ratings), 2) if ratings else 5.0
        ratings_count = len(ratings)
        open_att = await self.attendance.open_for_staff(staff.id)
        current_status = "inside" if open_att else "outside"
        active_assignments = await self.assignments.active_for_staff(staff.id)

        # Working hours metrics
        now = datetime.now(UTC)
        today_start = datetime(now.year, now.month, now.day, tzinfo=UTC)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = datetime(now.year, now.month, 1, tzinfo=UTC)

        month_attendances = await self.attendance.attendances_since(staff.id, month_start)

        hours_today = 0.0
        hours_week = 0.0
        hours_month = 0.0

        for att in month_attendances:
            ci = att.check_in_at
            if ci.tzinfo is None:
                ci = ci.replace(tzinfo=UTC)
            co = att.check_out_at
            if co is not None and co.tzinfo is None:
                co = co.replace(tzinfo=UTC)
            co = co or now
            dur = max(0.0, (co - ci).total_seconds() / 3600.0)
            hours_month += dur
            if ci >= week_start:
                hours_week += dur
            if ci >= today_start:
                hours_today += dur

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
            hours_worked_today=round(hours_today, 1),
            hours_worked_this_week=round(hours_week, 1),
            hours_worked_this_month=round(hours_month, 1),
        )

    async def update_my_profile(self, payload: schemas.StaffMeUpdate) -> schemas.StaffMeRead:
        staff = await self._resolve_my_staff()
        patch = payload.model_dump(exclude_unset=True)
        if patch.get("photo_url"):
            await ensure_confirmed_async(self.db, patch["photo_url"])
        for k, v in patch.items():
            setattr(staff, k, v)
        await self.db.flush()
        await self._audit(
            "staff.update_me", staff.community_id, "domestic_staff", staff.id, new=patch
        )
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
                    days_of_week=r.days_of_week or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
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
        staff_ratings = await self.ratings.for_staff(staff.id)
        ratings = {r.unit_id: r for r in staff_ratings}
        assignments = await self.assignments.active_for_staff(staff.id)
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

    async def get_my_ratings(self, *, offset: int = 0, limit: int = 50):
        staff = await self._resolve_my_staff()
        return await self.list_ratings(staff.id, offset=offset, limit=limit)

    # -- digital gate pass & verification ----------------------- #
    async def generate_my_pass(self) -> schemas.StaffPassRead:
        staff = await self._resolve_my_staff()
        from app.modules.communities.models import Community

        community = await self.db.get(Community, staff.community_id)
        community_name = community.name if community else "GateSphere Community"
        assignments, _ = await self.get_my_assignments(offset=0, limit=50)

        now = datetime.now(UTC)
        expires_at = (now + timedelta(hours=24)).replace(
            hour=23, minute=59, second=59, microsecond=0
        )
        pass_code = f"GSE:STAFF:{staff.id}:{staff.community_id}"
        return schemas.StaffPassRead(
            staff_id=staff.id,
            full_name=staff.full_name,
            staff_type=staff.staff_type,
            phone=staff.phone,
            photo_url=staff.photo_url,
            pass_code=pass_code,
            community_name=community_name,
            police_verification_status=staff.police_verification_status,
            active_assignments=assignments,
            generated_at=now,
            expires_at=expires_at,
        )

    async def verify_pass(self, payload: schemas.StaffPassVerifyIn) -> schemas.StaffPassVerifyOut:
        raw_code = payload.pass_code.strip()
        staff_id = None
        if raw_code.startswith("GSE:STAFF:"):
            parts = raw_code.split(":")
            if len(parts) >= 3:
                with contextlib.suppress(ValueError):
                    staff_id = uuid.UUID(parts[2])
        if staff_id is None:
            try:
                staff_id = uuid.UUID(raw_code)
            except ValueError:
                clean_phone = raw_code.replace(" ", "").replace("-", "")
                found = await self.staff.by_phone_scoped(clean_phone)
                if found is not None:
                    staff_id = found.id
                else:
                    raise BusinessRuleError(
                        "Invalid pass code format", code="INVALID_PASS_CODE"
                    ) from None

        staff = await self._staff_in_scope(staff_id)
        action = payload.action
        open_att = await self.attendance.open_for_staff(staff.id)

        if action == "check_in":
            if open_att:
                raise ConflictError("Staff member is already checked in", code="ALREADY_INSIDE")
            att = await self.check_in(
                schemas.CheckInCreate(staff_id=staff.id, gate_id=payload.gate_id)
            )
            msg = f"{staff.full_name} checked in successfully"
        else:
            if not open_att:
                raise BusinessRuleError("Staff member is not currently inside", code="NOT_INSIDE")
            att = await self.check_out(open_att.id)
            msg = f"{staff.full_name} checked out successfully"

        return schemas.StaffPassVerifyOut(
            success=True,
            action=action,
            staff=schemas.StaffRead.model_validate(staff),
            attendance=schemas.AttendanceRead.model_validate(att),
            message=msg,
        )

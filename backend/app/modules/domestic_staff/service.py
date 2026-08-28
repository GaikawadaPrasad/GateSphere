"""Business logic for Domestic Staff (FR-06).

- One staff record per phone per community (upsert by phone on create).
- One active assignment per (staff, unit).
- At most one open attendance row per staff; check-out requires an open row.
- One rating per (staff, unit, resident) — re-rating updates in place.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
        self, db: AsyncSession, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
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
            request=self.request,
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
        await ensure_confirmed_async(self.db, payload.photo_url)
        obj = DomesticStaff(
            community_id=cid,
            user_id=payload.user_id,
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
        stmt = stmt.order_by(DomesticStaff.full_name)
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

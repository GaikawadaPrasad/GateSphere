"""Data-access for Domestic Staff (FR-06). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select

from app.db.repository import AsyncTenantRepository
from app.modules.domestic_staff.models import (
    DomesticStaff,
    StaffAttendance,
    StaffRating,
    StaffUnitAssignment,
)


class StaffRepository(AsyncTenantRepository[DomesticStaff]):
    model = DomesticStaff

    async def by_phone(self, community_id: uuid.UUID, phone: str) -> DomesticStaff | None:
        return await self.db.scalar(
            select(DomesticStaff).where(
                DomesticStaff.community_id == community_id, DomesticStaff.phone == phone
            )
        )

    async def by_user_id(self, user_id: uuid.UUID) -> DomesticStaff | None:
        stmt = select(DomesticStaff).where(DomesticStaff.user_id == user_id)
        if not self.scope.is_global and self.scope.community_ids:
            stmt = stmt.where(DomesticStaff.community_id.in_(self.scope.community_ids))
        return await self.db.scalar(stmt)

    async def by_phone_scoped(self, phone: str) -> DomesticStaff | None:
        stmt = select(DomesticStaff).where(DomesticStaff.phone == phone)
        if not self.scope.is_global and self.scope.community_ids:
            stmt = stmt.where(DomesticStaff.community_id.in_(self.scope.community_ids))
        return await self.db.scalar(stmt)

    async def first_in_community(
        self, community_id: uuid.UUID, *, unlinked_only: bool = False
    ) -> DomesticStaff | None:
        stmt = (
            select(DomesticStaff)
            .where(DomesticStaff.community_id == community_id)
            .order_by(DomesticStaff.created_at)
        )
        if unlinked_only:
            stmt = stmt.where(DomesticStaff.user_id.is_(None))
        return await self.db.scalar(stmt)

    async def first_any(self) -> DomesticStaff | None:
        return await self.db.scalar(select(DomesticStaff).order_by(DomesticStaff.created_at))

    async def first_unit_id(self, community_id: uuid.UUID) -> uuid.UUID | None:
        from app.modules.communities.models import Unit

        stmt = select(Unit.id).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        return await self.db.scalar(stmt)


class AssignmentRepository(AsyncTenantRepository[StaffUnitAssignment]):
    model = StaffUnitAssignment

    async def active_for_pair(
        self, staff_id: uuid.UUID, unit_id: uuid.UUID
    ) -> StaffUnitAssignment | None:
        return await self.db.scalar(
            select(StaffUnitAssignment).where(
                StaffUnitAssignment.staff_id == staff_id,
                StaffUnitAssignment.unit_id == unit_id,
                StaffUnitAssignment.is_active.is_(True),
            )
        )

    async def active_for_staff(self, staff_id: uuid.UUID) -> list[StaffUnitAssignment]:
        stmt = select(StaffUnitAssignment).where(
            StaffUnitAssignment.staff_id == staff_id,
            StaffUnitAssignment.is_active.is_(True),
        )
        if not self.scope.is_global and self.scope.community_ids:
            stmt = stmt.where(StaffUnitAssignment.community_id.in_(self.scope.community_ids))
        return list((await self.db.scalars(stmt)).all())

    async def active_staff_ids_for_units(
        self, unit_ids: set[uuid.UUID] | frozenset[uuid.UUID] | list[uuid.UUID]
    ) -> list[uuid.UUID]:
        if not unit_ids:
            return []
        stmt = select(StaffUnitAssignment.staff_id).where(
            StaffUnitAssignment.unit_id.in_(unit_ids),
            StaffUnitAssignment.is_active.is_(True),
        )
        if not self.scope.is_global and self.scope.community_ids:
            stmt = stmt.where(StaffUnitAssignment.community_id.in_(self.scope.community_ids))
        return list((await self.db.scalars(stmt)).all())


class AttendanceRepository(AsyncTenantRepository[StaffAttendance]):
    model = StaffAttendance

    async def open_for_staff(self, staff_id: uuid.UUID) -> StaffAttendance | None:
        return await self.db.scalar(
            select(StaffAttendance).where(
                StaffAttendance.staff_id == staff_id,
                StaffAttendance.check_out_at.is_(None),
            )
        )

    async def attendances_since(
        self, staff_id: uuid.UUID, since: datetime
    ) -> list[StaffAttendance]:
        stmt = select(StaffAttendance).where(
            StaffAttendance.staff_id == staff_id,
            StaffAttendance.check_in_at >= since,
        )
        return list((await self.db.scalars(stmt)).all())


class RatingRepository(AsyncTenantRepository[StaffRating]):
    model = StaffRating

    async def for_staff(self, staff_id: uuid.UUID) -> list[StaffRating]:
        stmt = select(StaffRating).where(StaffRating.staff_id == staff_id)
        return list((await self.db.scalars(stmt)).all())

    async def for_pair(
        self, staff_id: uuid.UUID, unit_id: uuid.UUID, resident_user_id: uuid.UUID
    ) -> StaffRating | None:
        return await self.db.scalar(
            select(StaffRating).where(
                StaffRating.staff_id == staff_id,
                StaffRating.unit_id == unit_id,
                StaffRating.resident_user_id == resident_user_id,
            )
        )

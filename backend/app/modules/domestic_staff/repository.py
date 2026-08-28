"""Data-access for Domestic Staff (FR-06). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid

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


class AttendanceRepository(AsyncTenantRepository[StaffAttendance]):
    model = StaffAttendance

    async def open_for_staff(self, staff_id: uuid.UUID) -> StaffAttendance | None:
        return await self.db.scalar(
            select(StaffAttendance).where(
                StaffAttendance.staff_id == staff_id,
                StaffAttendance.check_out_at.is_(None),
            )
        )


class RatingRepository(AsyncTenantRepository[StaffRating]):
    model = StaffRating

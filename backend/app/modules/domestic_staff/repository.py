"""Data-access for Domestic Staff (FR-06). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.domestic_staff.models import (
    DomesticStaff,
    StaffAttendance,
    StaffRating,
    StaffUnitAssignment,
)


class StaffRepository(TenantRepository[DomesticStaff]):
    model = DomesticStaff

    def by_phone(self, community_id: uuid.UUID, phone: str) -> DomesticStaff | None:
        return self.db.scalar(
            select(DomesticStaff).where(
                DomesticStaff.community_id == community_id, DomesticStaff.phone == phone
            )
        )


class AssignmentRepository(TenantRepository[StaffUnitAssignment]):
    model = StaffUnitAssignment

    def active_for_pair(
        self, staff_id: uuid.UUID, unit_id: uuid.UUID
    ) -> StaffUnitAssignment | None:
        return self.db.scalar(
            select(StaffUnitAssignment).where(
                StaffUnitAssignment.staff_id == staff_id,
                StaffUnitAssignment.unit_id == unit_id,
                StaffUnitAssignment.is_active.is_(True),
            )
        )


class AttendanceRepository(TenantRepository[StaffAttendance]):
    model = StaffAttendance

    def open_for_staff(self, staff_id: uuid.UUID) -> StaffAttendance | None:
        return self.db.scalar(
            select(StaffAttendance).where(
                StaffAttendance.staff_id == staff_id,
                StaffAttendance.check_out_at.is_(None),
            )
        )


class RatingRepository(TenantRepository[StaffRating]):
    model = StaffRating

"""Data-access for Gate / Security Operations (FR-05). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.gate.models import GateAssignment, GateEvent, GuardRoster, PanicAlert


class GateEventRepository(TenantRepository[GateEvent]):
    model = GateEvent


class GuardRosterRepository(TenantRepository[GuardRoster]):
    model = GuardRoster


class GateAssignmentRepository(TenantRepository[GateAssignment]):
    model = GateAssignment

    def active_for_guard(self, guard_user_id: uuid.UUID) -> GateAssignment | None:
        return self.db.scalar(
            select(GateAssignment).where(
                GateAssignment.guard_user_id == guard_user_id,
                GateAssignment.status == "active",
            )
        )


class PanicAlertRepository(TenantRepository[PanicAlert]):
    model = PanicAlert

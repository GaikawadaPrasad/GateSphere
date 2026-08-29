"""Data-access for Gate / Security Operations (FR-05). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import AsyncTenantRepository
from app.modules.gate.models import GateAssignment, GateEvent, GuardRoster, PanicAlert


class GateEventRepository(AsyncTenantRepository[GateEvent]):
    model = GateEvent


class GuardRosterRepository(AsyncTenantRepository[GuardRoster]):
    model = GuardRoster


class GateAssignmentRepository(AsyncTenantRepository[GateAssignment]):
    model = GateAssignment

    async def active_for_guard(self, guard_user_id: uuid.UUID) -> GateAssignment | None:
        return await self.db.scalar(
            select(GateAssignment).where(
                GateAssignment.guard_user_id == guard_user_id,
                GateAssignment.status == "active",
            )
        )


class PanicAlertRepository(AsyncTenantRepository[PanicAlert]):
    model = PanicAlert

"""Data-access for Emergency & Incident Management (FR-13). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.db.repository import AsyncTenantRepository
from app.modules.incidents.models import IncidentAssignment, SecurityIncident


class IncidentRepository(AsyncTenantRepository[SecurityIncident]):
    model = SecurityIncident

    async def next_sequence(self, community_id: uuid.UUID) -> int:
        n = await self.db.scalar(
            select(func.count())
            .select_from(SecurityIncident)
            .where(SecurityIncident.community_id == community_id)
        )
        return int(n or 0) + 1


async def active_assignments(db, incident_id: uuid.UUID) -> list[IncidentAssignment]:
    return list(
        (
            await db.scalars(
                select(IncidentAssignment).where(
                    IncidentAssignment.incident_id == incident_id,
                    IncidentAssignment.is_active.is_(True),
                )
            )
        ).all()
    )


async def assignment_for(
    db, incident_id: uuid.UUID, user_id: uuid.UUID
) -> IncidentAssignment | None:
    return await db.scalar(
        select(IncidentAssignment).where(
            IncidentAssignment.incident_id == incident_id,
            IncidentAssignment.assigned_user_id == user_id,
            IncidentAssignment.is_active.is_(True),
        )
    )

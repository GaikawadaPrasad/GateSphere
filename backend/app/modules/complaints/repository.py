"""Data-access for Complaint & Service Desk (FR-10). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.db.repository import AsyncTenantRepository
from app.modules.complaints.models import (
    ServiceCategory,
    ServiceTicket,
    SlaPolicy,
    TicketAssignment,
)


class CategoryRepository(AsyncTenantRepository[ServiceCategory]):
    model = ServiceCategory

    async def by_code(self, community_id: uuid.UUID, code: str) -> ServiceCategory | None:
        return await self.db.scalar(
            select(ServiceCategory).where(
                ServiceCategory.community_id == community_id, ServiceCategory.code == code
            )
        )


class SlaRepository(AsyncTenantRepository[SlaPolicy]):
    model = SlaPolicy

    async def match(
        self, community_id: uuid.UUID, category_id: uuid.UUID, priority: str
    ) -> SlaPolicy | None:
        return await self.db.scalar(
            select(SlaPolicy).where(
                SlaPolicy.community_id == community_id,
                SlaPolicy.category_id == category_id,
                SlaPolicy.priority == priority,
                SlaPolicy.is_active.is_(True),
            )
        )


class TicketRepository(AsyncTenantRepository[ServiceTicket]):
    model = ServiceTicket

    async def next_sequence(self, community_id: uuid.UUID) -> int:
        n = await self.db.scalar(
            select(func.count())
            .select_from(ServiceTicket)
            .where(ServiceTicket.community_id == community_id)
        )
        return int(n or 0) + 1


async def active_assignment(db, ticket_id: uuid.UUID) -> TicketAssignment | None:
    return await db.scalar(
        select(TicketAssignment).where(
            TicketAssignment.ticket_id == ticket_id, TicketAssignment.is_active.is_(True)
        )
    )

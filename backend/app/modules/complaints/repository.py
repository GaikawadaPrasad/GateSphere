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

    async def enrich_tickets(self, tickets: list[ServiceTicket]) -> None:
        if not tickets:
            return

        user_ids = {t.raised_by_user_id for t in tickets if t.raised_by_user_id}
        comm_ids = {t.community_id for t in tickets if t.community_id}
        unit_ids = {t.unit_id for t in tickets if t.unit_id}
        category_ids = {t.category_id for t in tickets if t.category_id}

        user_map: dict[uuid.UUID, tuple[str, str | None, str | None]] = {}
        if user_ids:
            from app.modules.users.models import User

            stmt = select(User.id, User.full_name, User.email, User.phone).where(
                User.id.in_(user_ids)
            )
            res = (await self.db.execute(stmt)).all()
            for uid, name, email, phone in res:
                user_map[uid] = (name, email, phone)

        comm_map: dict[uuid.UUID, str] = {}
        if comm_ids:
            from app.modules.communities.models import Community

            stmt = select(Community.id, Community.name).where(Community.id.in_(comm_ids))
            res = (await self.db.execute(stmt)).all()
            for cid, name in res:
                comm_map[cid] = name

        unit_map: dict[uuid.UUID, str] = {}
        if unit_ids:
            from app.modules.communities.models import Unit

            stmt = select(Unit.id, Unit.unit_number).where(Unit.id.in_(unit_ids))
            res = (await self.db.execute(stmt)).all()
            for uid, num in res:
                unit_map[uid] = num

        cat_map: dict[uuid.UUID, str] = {}
        if category_ids:
            stmt = select(ServiceCategory.id, ServiceCategory.name).where(
                ServiceCategory.id.in_(category_ids)
            )
            res = (await self.db.execute(stmt)).all()
            for cid, name in res:
                cat_map[cid] = name

        for t in tickets:
            u_info = user_map.get(t.raised_by_user_id) if t.raised_by_user_id else None
            t.raised_by_name = u_info[0] if u_info else None
            t.raised_by_email = u_info[1] if u_info else None
            t.raised_by_phone = u_info[2] if u_info else None
            t.community_name = comm_map.get(t.community_id)
            t.unit_number = unit_map.get(t.unit_id)
            t.category_name = cat_map.get(t.category_id)


async def active_assignment(db, ticket_id: uuid.UUID) -> TicketAssignment | None:
    return await db.scalar(
        select(TicketAssignment).where(
            TicketAssignment.ticket_id == ticket_id, TicketAssignment.is_active.is_(True)
        )
    )

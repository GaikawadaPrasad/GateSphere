"""Data-access for Communication & Broadcasts (FR-12). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.repository import AsyncTenantRepository
from app.modules.communication.models import (
    Announcement,
    Poll,
    PollResponse,
    PollResponseOption,
)


class AnnouncementRepository(AsyncTenantRepository[Announcement]):
    model = Announcement

    async def get(self, obj_id: uuid.UUID) -> Announcement | None:
        return await self.db.scalar(
            self._scoped(select(Announcement).where(Announcement.id == obj_id))
            .execution_options(populate_existing=True)
            .options(selectinload(Announcement.targets))
        )


class PollRepository(AsyncTenantRepository[Poll]):
    model = Poll

    async def get(self, obj_id: uuid.UUID) -> Poll | None:
        return await self.db.scalar(
            self._scoped(select(Poll).where(Poll.id == obj_id))
            .execution_options(populate_existing=True)
            .options(selectinload(Poll.options), selectinload(Poll.announcement))
        )

    async def by_announcement(self, announcement_id: uuid.UUID) -> Poll | None:
        return await self.db.scalar(select(Poll).where(Poll.announcement_id == announcement_id))


async def response_for(db, poll_id: uuid.UUID, user_id: uuid.UUID) -> PollResponse | None:
    return await db.scalar(
        select(PollResponse).where(PollResponse.poll_id == poll_id, PollResponse.user_id == user_id)
    )


async def tally(db, poll_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = (
        await db.execute(
            select(PollResponseOption.option_id, func.count())
            .join(PollResponse, PollResponse.id == PollResponseOption.response_id)
            .where(PollResponse.poll_id == poll_id)
            .group_by(PollResponseOption.option_id)
        )
    ).all()
    return {oid: int(n) for oid, n in rows}


async def response_count(db, poll_id: uuid.UUID) -> int:
    return int(
        await db.scalar(
            select(func.count()).select_from(PollResponse).where(PollResponse.poll_id == poll_id)
        )
        or 0
    )

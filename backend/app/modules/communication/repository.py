"""Data-access for Communication & Broadcasts (FR-12). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.db.repository import TenantRepository
from app.modules.communication.models import (
    Announcement,
    Poll,
    PollResponse,
    PollResponseOption,
)


class AnnouncementRepository(TenantRepository[Announcement]):
    model = Announcement


class PollRepository(TenantRepository[Poll]):
    model = Poll

    def by_announcement(self, announcement_id: uuid.UUID) -> Poll | None:
        return self.db.scalar(select(Poll).where(Poll.announcement_id == announcement_id))


def response_for(db, poll_id: uuid.UUID, user_id: uuid.UUID) -> PollResponse | None:
    return db.scalar(
        select(PollResponse).where(PollResponse.poll_id == poll_id, PollResponse.user_id == user_id)
    )


def tally(db, poll_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(PollResponseOption.option_id, func.count())
        .join(PollResponse, PollResponse.id == PollResponseOption.response_id)
        .where(PollResponse.poll_id == poll_id)
        .group_by(PollResponseOption.option_id)
    ).all()
    return {oid: int(n) for oid, n in rows}


def response_count(db, poll_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count()).select_from(PollResponse).where(PollResponse.poll_id == poll_id)
        )
        or 0
    )

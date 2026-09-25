"""Data access for the realtime channel (queries only)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import UserSession
from app.modules.users.models import User, UserRole


async def live_session_user(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> User | None:
    """The active user behind a still-valid (not revoked, not expired) session, else None."""
    row = await db.scalar(
        select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user_id)
    )
    if row is None or row.revoked_at is not None or row.expires_at <= datetime.now(UTC):
        return None
    user = await db.get(User, user_id)
    return user if user is not None and user.is_active else None


async def community_grants(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID | None]:
    """Community ids of every role grant (`None` = a platform-global grant)."""
    return list(
        (await db.scalars(select(UserRole.community_id).where(UserRole.user_id == user_id))).all()
    )

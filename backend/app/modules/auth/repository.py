"""Data-access layer for Authentication. SQLAlchemy queries only; no business rules."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import Role, User, UserRole


class AuthRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def user_by_email(self, email: str) -> User | None:
        return await self.db.scalar(select(User).where(User.email == email.lower()))

    async def role_grants(self, user_id: uuid.UUID) -> list[tuple[str, uuid.UUID | None]]:
        """[(role_slug, community_id | None)] for every grant the user holds."""
        rows = (
            await self.db.execute(
                select(Role.slug, UserRole.community_id)
                .join(UserRole, UserRole.role_id == Role.id)
                .where(UserRole.user_id == user_id)
            )
        ).all()
        return [(slug, cid) for slug, cid in rows]

    async def community_ids(self, user_id: uuid.UUID) -> list[uuid.UUID]:
        rows = await self.db.scalars(
            select(UserRole.community_id).where(UserRole.user_id == user_id)
        )
        return [c for c in rows if c is not None]

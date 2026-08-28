from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.tenancy import TenantScope
from app.db.session import AsyncSessionLocal
from app.modules.communities.models import Community
from app.modules.users.models import User


@pytest_asyncio.fixture()
async def db():
    """A rolled-back async session — unit tests never persist."""
    session = AsyncSessionLocal()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()


@pytest_asyncio.fixture()
async def superadmin(db) -> User:
    return await db.scalar(select(User).where(User.is_superadmin.is_(True)))


@pytest_asyncio.fixture()
async def community(db) -> Community:
    c = Community(code=f"ut-{uuid.uuid4().hex[:8]}", name="Unit Test Community")
    db.add(c)
    await db.flush()
    return c


@pytest.fixture()
def global_scope(superadmin) -> TenantScope:
    return TenantScope(superadmin.id, is_global=True, community_ids=frozenset())


@pytest.fixture()
def scope_for(superadmin):
    def _make(community_id: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({community_id}))

    return _make

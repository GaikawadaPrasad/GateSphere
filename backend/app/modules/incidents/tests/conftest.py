from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.db.session import AsyncSessionLocal
from app.modules.communities.models import Community
from app.modules.users.models import Role, User, UserRole


@pytest_asyncio.fixture()
async def db():
    s = AsyncSessionLocal()
    try:
        yield s
    finally:
        await s.rollback()
        await s.close()


@pytest_asyncio.fixture()
async def superadmin(db) -> User:
    return await db.scalar(select(User).where(User.is_superadmin.is_(True)))


@pytest_asyncio.fixture()
async def community(db) -> Community:
    c = Community(code=f"in-{uuid.uuid4().hex[:8]}", name="Incidents Test Community")
    db.add(c)
    await db.flush()
    return c


@pytest_asyncio.fixture()
async def make_user(db):
    async def _make(community: Community | None = None) -> User:
        u = User(
            email=f"in-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Responder",
            password_hash=hash_password("x"),
        )
        db.add(u)
        await db.flush()
        if community is not None:  # make them a member (community-scoped role grant)
            role = await db.scalar(select(Role).where(Role.slug == "security_guard"))
            db.add(UserRole(user_id=u.id, role_id=role.id, community_id=community.id))
            await db.flush()
        return u

    return _make


@pytest.fixture()
def scope_for(superadmin):
    def _make(cid: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({cid}))

    return _make

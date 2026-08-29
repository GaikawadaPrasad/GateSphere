from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.db.session import AsyncSessionLocal
from app.modules.communities.models import Community, Floor, Tower, Unit
from app.modules.complaints.models import ServiceCategory, SlaPolicy
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
    c = Community(code=f"cp-{uuid.uuid4().hex[:8]}", name="Complaints Test Community")
    db.add(c)
    await db.flush()
    return c


@pytest_asyncio.fixture()
async def unit(db, community) -> Unit:
    t = Tower(community_id=community.id, code="T1", name="Tower 1")
    db.add(t)
    await db.flush()
    f = Floor(community_id=community.id, tower_id=t.id, floor_number=1)
    db.add(f)
    await db.flush()
    u = Unit(community_id=community.id, tower_id=t.id, floor_id=f.id, unit_number="1-01")
    db.add(u)
    await db.flush()
    return u


@pytest_asyncio.fixture()
async def category(db, community) -> ServiceCategory:
    cat = ServiceCategory(
        community_id=community.id, code="PLUMB", name="Plumbing", default_priority="high"
    )
    db.add(cat)
    await db.flush()
    db.add(
        SlaPolicy(
            community_id=community.id,
            category_id=cat.id,
            priority="high",
            response_minutes=60,
            resolution_minutes=1440,
            escalation_minutes=2880,
        )
    )
    await db.flush()
    return cat


@pytest_asyncio.fixture()
async def make_user(db):
    async def _make(community: Community | None = None) -> User:
        u = User(
            email=f"cp-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Tech",
            password_hash=hash_password("x"),
        )
        db.add(u)
        await db.flush()
        if community is not None:  # make them a member (community-scoped role grant)
            role = await db.scalar(select(Role).where(Role.slug == "vendor_technician"))
            db.add(UserRole(user_id=u.id, role_id=role.id, community_id=community.id))
            await db.flush()
        return u

    return _make


@pytest.fixture()
def scope_for(superadmin):
    def _make(cid: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({cid}))

    return _make

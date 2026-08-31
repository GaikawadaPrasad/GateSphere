from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.modules.communities.models import Community, Floor, Tower, Unit
from app.modules.users.models import User


@pytest_asyncio.fixture()
async def superadmin(db) -> User:
    return await db.scalar(select(User).where(User.is_superadmin.is_(True)))


@pytest_asyncio.fixture()
async def community(db) -> Community:
    c = Community(code=f"ds-{uuid.uuid4().hex[:8]}", name="Domestic Staff Test Community")
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
async def make_user(db):
    async def _make() -> User:
        u = User(
            email=f"ds-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Resident",
            password_hash=hash_password("x"),
        )
        db.add(u)
        await db.flush()
        return u

    return _make


@pytest.fixture()
def scope_for(superadmin):
    def _make(cid: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({cid}))

    return _make

from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.modules.communities.models import Community
from app.modules.users.models import User


@pytest_asyncio.fixture()
async def superadmin(db) -> User:
    return await db.scalar(select(User).where(User.is_superadmin.is_(True)))


@pytest_asyncio.fixture()
async def community(db) -> Community:
    c = Community(code=f"cm-{uuid.uuid4().hex[:8]}", name="Comms Test Community")
    db.add(c)
    await db.flush()
    return c


@pytest_asyncio.fixture()
async def make_user(db):
    async def _make() -> User:
        u = User(
            email=f"cm-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Voter",
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

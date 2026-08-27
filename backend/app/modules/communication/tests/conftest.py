from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.db.session import SessionLocal
from app.modules.communities.models import Community
from app.modules.users.models import User


@pytest.fixture()
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        s.close()


@pytest.fixture()
def superadmin(db) -> User:
    return db.scalar(select(User).where(User.is_superadmin.is_(True)))


@pytest.fixture()
def community(db) -> Community:
    c = Community(code=f"cm-{uuid.uuid4().hex[:8]}", name="Comms Test Community")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def make_user(db):
    def _make() -> User:
        u = User(
            email=f"cm-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Voter",
            password_hash=hash_password("x"),
        )
        db.add(u)
        db.flush()
        return u

    return _make


@pytest.fixture()
def scope_for(superadmin):
    def _make(cid: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({cid}))

    return _make

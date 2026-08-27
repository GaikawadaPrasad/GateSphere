from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.db.session import SessionLocal
from app.modules.communities.models import Community, Floor, Tower, Unit
from app.modules.users.models import User


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def superadmin(db) -> User:
    return db.scalar(select(User).where(User.is_superadmin.is_(True)))


@pytest.fixture()
def community(db) -> Community:
    c = Community(code=f"rt-{uuid.uuid4().hex[:8]}", name="Residents Test Community")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def unit(db, community) -> Unit:
    t = Tower(community_id=community.id, code="TA", name="Tower A")
    db.add(t)
    db.flush()
    f = Floor(community_id=community.id, tower_id=t.id, floor_number=1)
    db.add(f)
    db.flush()
    u = Unit(
        community_id=community.id,
        tower_id=t.id,
        floor_id=f.id,
        unit_number="A-101",
        unit_type="apartment",
    )
    db.add(u)
    db.flush()
    return u


@pytest.fixture()
def make_user(db):
    def _make() -> User:
        u = User(
            email=f"u-{uuid.uuid4().hex[:10]}@example.test",
            full_name="Test User",
            password_hash=hash_password("x"),
        )
        db.add(u)
        db.flush()
        return u

    return _make


@pytest.fixture()
def scope_for(superadmin):
    def _make(community_id: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({community_id}))

    return _make

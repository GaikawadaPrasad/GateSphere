from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select

from app.core.tenancy import TenantScope
from app.db.session import SessionLocal
from app.modules.communities.models import Community
from app.modules.users.models import User


@pytest.fixture()
def db():
    """A rolled-back session — unit tests never persist."""
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
    c = Community(code=f"ut-{uuid.uuid4().hex[:8]}", name="Unit Test Community")
    db.add(c)
    db.flush()
    return c


@pytest.fixture()
def global_scope(superadmin) -> TenantScope:
    return TenantScope(superadmin.id, is_global=True, community_ids=frozenset())


@pytest.fixture()
def scope_for(superadmin):
    def _make(community_id: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({community_id}))

    return _make

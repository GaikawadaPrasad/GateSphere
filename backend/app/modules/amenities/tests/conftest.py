from __future__ import annotations

import uuid
from datetime import time

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.security import hash_password
from app.core.tenancy import TenantScope
from app.db.session import AsyncSessionLocal
from app.modules.amenities.models import Amenity, AmenitySlot
from app.modules.communities.models import Community, Floor, Tower, Unit
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import User


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
    c = Community(code=f"am-{uuid.uuid4().hex[:8]}", name="Amenities Test Community")
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
async def resident(db, community, unit) -> User:
    u = User(
        email=f"am-{uuid.uuid4().hex[:10]}@example.test",
        full_name="Res",
        password_hash=hash_password("x"),
    )
    db.add(u)
    await db.flush()
    p = ResidentProfile(community_id=community.id, user_id=u.id, profile_status="active")
    db.add(p)
    await db.flush()
    db.add(
        UnitOccupancy(
            community_id=community.id,
            unit_id=unit.id,
            resident_profile_id=p.id,
            occupancy_role="primary_owner",
            is_primary=True,
        )
    )
    await db.flush()
    return u


@pytest_asyncio.fixture()
async def amenity(db, community):
    a = Amenity(
        community_id=community.id, code="POOL", name="Pool", amenity_type="pool", capacity=4
    )
    db.add(a)
    await db.flush()
    # a slot for every weekday, 06:00-22:00
    for dow in range(7):
        db.add(
            AmenitySlot(
                community_id=community.id,
                amenity_id=a.id,
                day_of_week=dow,
                start_time=time(6, 0),
                end_time=time(8, 0),
                capacity=4,
            )
        )
    await db.flush()
    return a


@pytest.fixture()
def scope_for(superadmin):
    def _make(cid: uuid.UUID) -> TenantScope:
        return TenantScope(superadmin.id, is_global=False, community_ids=frozenset({cid}))

    return _make

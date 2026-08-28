"""Async migration — infra smoke test.

Proves the async engine/session added in `app/db/session.py` can talk to the same
database as the sync stack. Modules are converted to async one at a time on top of this.
"""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.modules.communities.models import Community


async def test_async_session_reads_seed_data():
    async with AsyncSessionLocal() as db:
        rows = (await db.scalars(select(Community).order_by(Community.code))).all()
    assert len(rows) >= 2  # the seed loads two communities


async def test_async_rls_guc_roundtrips():
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        await db.execute(text("SELECT set_config('app.community_ids', :v, true)"), {"v": "abc"})
        got = await db.scalar(text("SELECT current_setting('app.community_ids', true)"))
    assert got == "abc"

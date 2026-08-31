"""IS-2 — the `db` fixture (backend/conftest.py) gives unit-level tests a
transactionally-isolated session: writes are rolled back at teardown even when the
code under test calls `.commit()`, and nothing leaks between tests.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.modules.communities.models import Community

_MARKER = "is2-isolation-probe"


async def test_a_writes_and_commits_a_row(db):
    c = Community(code=f"is2-{uuid.uuid4().hex[:8]}", name=_MARKER)
    db.add(c)
    await db.commit()  # becomes a SAVEPOINT release — still inside the outer txn
    got = await db.scalar(
        select(func.count()).select_from(Community).where(Community.name == _MARKER)
    )
    assert got == 1


async def test_b_never_sees_the_row_from_test_a(db):
    leaked = await db.scalar(
        select(func.count()).select_from(Community).where(Community.name == _MARKER)
    )
    assert leaked == 0, "the previous test's committed row leaked — fixture is not isolating"

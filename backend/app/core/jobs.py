"""Shared plumbing for Celery scheduled jobs (async — ADR-010).

Background sweeps run outside any HTTP request, so they have no `TenantScope`
from middleware and no authenticated actor. They use:

- `job_session()` — an async `AsyncSession` context manager that commits on
  success, rolls back on error, always closes.
- `system_scope()` — a global `TenantScope` (sees every community).
- `system_actor(db)` — the seeded `system@` user, used as the audit actor so
  every automated change is still attributable.

A Celery task body is `async def _foo(): ...` invoked via `run(_foo())`.
Jobs must apply the **same** state-transition rules as the API.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Coroutine
from contextlib import asynccontextmanager
from typing import Any, TypeVar

from sqlalchemy import event, select
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, SessionTransaction

from app.core.realtime import discard_pending, publish_pending
from app.core.tenancy import RLS_GLOBAL_SCOPE, TenantScope
from app.db.session import AsyncSessionLocal
from app.modules.users.models import User

SYSTEM_ACTOR_EMAIL = "system@gatesphere.com"

_T = TypeVar("_T")


def run(coro: Coroutine[Any, Any, _T]) -> _T:
    """Run an async task body from a sync Celery task."""
    return asyncio.run(coro)


def _bind_global_rls_scope(
    session: Session, transaction: SessionTransaction, connection: Connection
) -> None:
    # RLS is fail-closed (migration 0045): a system job sees every community only by
    # binding the explicit global sentinel. Transaction-local, re-applied on every begin.
    connection.exec_driver_sql(
        "SELECT set_config('app.community_ids', %(v)s, true)", {"v": RLS_GLOBAL_SCOPE}
    )


@asynccontextmanager
async def job_session() -> AsyncIterator[AsyncSession]:
    db = AsyncSessionLocal()
    event.listen(db.sync_session, "after_begin", _bind_global_rls_scope)
    try:
        yield db
        await db.commit()
    except Exception:
        discard_pending(db)
        await db.rollback()
        raise
    else:
        await publish_pending(db)  # realtime hints for sweep-driven changes (after commit)
    finally:
        await db.close()


async def system_actor(db: AsyncSession) -> User | None:
    return await db.scalar(select(User).where(User.email == SYSTEM_ACTOR_EMAIL))


def system_scope(actor: User | None = None) -> TenantScope:
    from uuid import UUID

    uid = actor.id if actor else UUID(int=0)
    return TenantScope(
        user_id=uid,
        is_global=True,
        community_ids=frozenset(),
        permissions=frozenset({"*"}),
    )

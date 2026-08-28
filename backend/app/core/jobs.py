"""Shared plumbing for Celery scheduled jobs.

Background sweeps run outside any HTTP request, so they have no `TenantScope`
from middleware and no authenticated actor. They use:

- `job_session()` — a plain `Session` context manager that commits on success,
  rolls back on error, always closes.
- `system_scope()` — a global `TenantScope` (sees every community).
- `system_actor(db)` — the seeded `system@` user, used as the audit actor so
  every automated change is still attributable.

Jobs must apply the **same** state-transition rules as the API (AGENTS.md §
"Workflow state machines"): import the service-layer transition maps, never
hand-roll status changes.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.tenancy import TenantScope
from app.db.session import SessionLocal
from app.modules.users.models import User

SYSTEM_ACTOR_EMAIL = "system@gatesphere.com"


@contextmanager
def job_session() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def system_actor(db: Session) -> User | None:
    return db.scalar(select(User).where(User.email == SYSTEM_ACTOR_EMAIL))


def system_scope(actor: User | None = None) -> TenantScope:
    from uuid import UUID

    uid = actor.id if actor else UUID(int=0)
    return TenantScope(user_id=uid, is_global=True, community_ids=frozenset())

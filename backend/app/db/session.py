"""Database engines and session dependencies.

Two stacks run side by side during the async migration:

- **sync** (`engine` / `SessionLocal` / `get_db`) — the current default for every router,
  service, repository, Celery task and test.
- **async** (`async_engine` / `AsyncSessionLocal` / `get_async_db`) — the target. Modules
  are converted one at a time; until a module is converted it keeps using the sync stack.

Both point at the same PostgreSQL database (psycopg 3 serves sync and async).
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# --- sync ---------------------------------------------------------------------
engine = create_engine(settings.sqlalchemy_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


def get_db() -> Iterator[Session]:
    """FastAPI dependency. Commits on success, rolls back on exception."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# --- async -------------------------------------------------------------------
async_engine = create_async_engine(settings.sqlalchemy_async_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, autocommit=False, autoflush=False, expire_on_commit=False
)


async def get_async_db() -> AsyncIterator[AsyncSession]:
    """Async counterpart of `get_db` — commit on success, rollback on exception."""
    async with AsyncSessionLocal() as db:
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise

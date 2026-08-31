"""Database engines and session factories (ADR-010).

- **async** (`async_engine` / `AsyncSessionLocal` / `get_async_db`) — the app request
  path and every Celery job. This is the production stack.
- **sync** (`engine` / `SessionLocal`) — the seed script and test scaffolding only
  (setup rows, assertions, the RLS-enforcement suite's restricted-role connection).
  Not wired into any FastAPI dependency.

Both point at the same PostgreSQL database (psycopg 3 serves sync and async).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# --- async (app + jobs) -----------------------------------------------------
_POOL_KW = {
    "pool_pre_ping": True,
    "pool_size": settings.DB_POOL_SIZE,
    "max_overflow": settings.DB_MAX_OVERFLOW,
    "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
}
async_engine = create_async_engine(settings.sqlalchemy_async_url, **_POOL_KW)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine, autocommit=False, autoflush=False, expire_on_commit=False
)


async def get_async_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency — commit on success, rollback on exception, always close."""
    async with AsyncSessionLocal() as db:
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise


# --- sync (seed script + tests only) --------------------------------------
engine = create_engine(settings.sqlalchemy_url, future=True, **_POOL_KW)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

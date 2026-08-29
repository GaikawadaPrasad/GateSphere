"""Base repositories (async — ADR-010).

`AsyncRepository` — generic CRUD for non-tenant tables.
`AsyncTenantRepository` — the same, but **every** query is filtered by the caller's
`TenantScope` before execution (AGENTS.md §3). Escaping that filter is not possible
through this class — write a deliberate, named method if you ever truly need to.
"""

from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import TenantScope
from app.db.base_class import Base

M = TypeVar("M", bound=Base)


class AsyncRepository(Generic[M]):
    model: type[M]

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, obj_id: uuid.UUID) -> M | None:
        return await self.db.get(self.model, obj_id)

    async def add(self, obj: M) -> M:
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def delete(self, obj: M) -> None:
        await self.db.delete(obj)
        await self.db.flush()


class AsyncTenantRepository(AsyncRepository[M]):
    """Requires `model` to have a `community_id` column."""

    def __init__(self, db: AsyncSession, scope: TenantScope) -> None:
        super().__init__(db)
        self.scope = scope

    def _scoped(self, stmt: Select) -> Select:
        if self.scope.is_global:
            return stmt
        return stmt.where(self.model.community_id.in_(self.scope.community_ids))  # type: ignore[attr-defined]

    async def get(self, obj_id: uuid.UUID) -> M | None:
        return await self.db.scalar(
            self._scoped(
                select(self.model).where(self.model.id == obj_id)
            ).execution_options(  # type: ignore[attr-defined]
                populate_existing=True
            )
        )

    async def list(
        self, *, offset: int = 0, limit: int = 20, extra: Select | None = None
    ) -> list[M]:
        stmt = extra if extra is not None else select(self.model)
        stmt = self._scoped(stmt).offset(offset).limit(limit)
        return list((await self.db.scalars(stmt)).all())

    async def count(self, *, extra: Select | None = None) -> int:
        base = extra if extra is not None else select(self.model)
        stmt = self._scoped(base).with_only_columns(func.count()).order_by(None)
        return int(await self.db.scalar(stmt) or 0)

    async def add(self, obj: M) -> M:
        self.scope.require(getattr(obj, "community_id", None))
        return await super().add(obj)

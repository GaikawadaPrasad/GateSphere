"""Base repositories.

`Repository` — generic CRUD for non-tenant tables.
`TenantRepository` — the same, but **every** query is filtered by the caller's
`TenantScope` before execution (AGENTS.md §3). Escaping that filter is not possible
through this class — write a deliberate, named method if you ever truly need to.
"""

from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.tenancy import TenantScope
from app.db.base_class import Base

M = TypeVar("M", bound=Base)


class Repository(Generic[M]):
    model: type[M]

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, obj_id: uuid.UUID) -> M | None:
        return self.db.get(self.model, obj_id)

    def add(self, obj: M) -> M:
        self.db.add(obj)
        self.db.flush()
        return obj

    def delete(self, obj: M) -> None:
        self.db.delete(obj)
        self.db.flush()


class TenantRepository(Repository[M]):
    """Requires `model` to have a `community_id` column."""

    def __init__(self, db: Session, scope: TenantScope) -> None:
        super().__init__(db)
        self.scope = scope

    def _scoped(self, stmt: Select) -> Select:
        if self.scope.is_global:
            return stmt
        return stmt.where(self.model.community_id.in_(self.scope.community_ids))  # type: ignore[attr-defined]

    def get(self, obj_id: uuid.UUID) -> M | None:
        row = self.db.scalar(self._scoped(select(self.model).where(self.model.id == obj_id)))  # type: ignore[attr-defined]
        return row

    def list(self, *, offset: int = 0, limit: int = 20, extra: Select | None = None) -> list[M]:
        stmt = extra if extra is not None else select(self.model)
        stmt = self._scoped(stmt).offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def count(self, *, extra: Select | None = None) -> int:
        base = extra if extra is not None else select(self.model)
        stmt = self._scoped(base).with_only_columns(func.count()).order_by(None)
        return int(self.db.scalar(stmt) or 0)

    def add(self, obj: M) -> M:
        cid = getattr(obj, "community_id", None)
        self.scope.require(cid)
        return super().add(obj)

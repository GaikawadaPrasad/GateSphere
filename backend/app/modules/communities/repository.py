"""Data-access for Community & Property (FR-03). Queries only — no business rules."""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.tenancy import TenantScope
from app.db.repository import TenantRepository
from app.modules.communities.models import Community, Floor, Gate, Tower, Unit


class CommunityRepository:
    """`communities` is the tenant root — filter on `id`, not `community_id`."""

    def __init__(self, db: Session, scope: TenantScope) -> None:
        self.db = db
        self.scope = scope

    def _scoped(self, stmt: Select) -> Select:
        if self.scope.is_global:
            return stmt
        return stmt.where(Community.id.in_(self.scope.community_ids))

    def get(self, community_id: uuid.UUID) -> Community | None:
        return self.db.scalar(self._scoped(select(Community).where(Community.id == community_id)))

    def get_by_code(self, code: str) -> Community | None:
        return self.db.scalar(select(Community).where(Community.code == code.lower()))

    def list(self, *, offset: int, limit: int, active: bool | None = None) -> list[Community]:
        stmt = select(Community)
        if active is not None:
            stmt = stmt.where(Community.is_active.is_(active))
        stmt = self._scoped(stmt).order_by(Community.name).offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def count(self, *, active: bool | None = None) -> int:
        stmt = select(func.count()).select_from(Community)
        if active is not None:
            stmt = stmt.where(Community.is_active.is_(active))
        return int(self.db.scalar(self._scoped(stmt)) or 0)

    def add(self, obj: Community) -> Community:
        self.db.add(obj)
        self.db.flush()
        return obj


class GateRepository(TenantRepository[Gate]):
    model = Gate

    def by_code(self, community_id: uuid.UUID, code: str) -> Gate | None:
        return self.db.scalar(
            select(Gate).where(Gate.community_id == community_id, Gate.code == code)
        )


class TowerRepository(TenantRepository[Tower]):
    model = Tower

    def by_name(self, community_id: uuid.UUID, name: str) -> Tower | None:
        return self.db.scalar(
            select(Tower).where(Tower.community_id == community_id, Tower.name == name)
        )


class FloorRepository(TenantRepository[Floor]):
    model = Floor

    def in_tower(self, *, tower_id: uuid.UUID, offset: int, limit: int) -> list[Floor]:
        return self.list(
            offset=offset,
            limit=limit,
            extra=select(Floor).where(Floor.tower_id == tower_id).order_by(Floor.floor_number),
        )

    def by_number(
        self, *, community_id: uuid.UUID, tower_id: uuid.UUID, number: int
    ) -> Floor | None:
        return self.db.scalar(
            select(Floor).where(
                Floor.community_id == community_id,
                Floor.tower_id == tower_id,
                Floor.floor_number == number,
            )
        )


class UnitRepository(TenantRepository[Unit]):
    model = Unit

    def by_number(
        self, *, community_id: uuid.UUID, tower_id: uuid.UUID, floor_id: uuid.UUID, number: str
    ) -> Unit | None:
        return self.db.scalar(
            select(Unit).where(
                Unit.community_id == community_id,
                Unit.tower_id == tower_id,
                Unit.floor_id == floor_id,
                Unit.unit_number == number,
            )
        )

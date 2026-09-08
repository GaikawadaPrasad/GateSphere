"""Data-access for Community & Property (FR-03). Queries only — no business rules.

Async stack (ADR-010).
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import TenantScope
from app.db.repository import AsyncTenantRepository
from app.modules.communities.models import Community, Floor, Gate, Tower, Unit


class CommunityRepository:
    """`communities` is the tenant root — filter on `id`, not `community_id`."""

    def __init__(self, db: AsyncSession, scope: TenantScope) -> None:
        self.db = db
        self.scope = scope

    def _scoped(self, stmt: Select) -> Select:
        if self.scope.is_global:
            return stmt
        return stmt.where(Community.id.in_(self.scope.community_ids))

    async def get(self, community_id: uuid.UUID) -> Community | None:
        return await self.db.scalar(
            self._scoped(select(Community).where(Community.id == community_id))
        )

    async def get_by_code(self, code: str) -> Community | None:
        return await self.db.scalar(select(Community).where(Community.code == code.lower()))

    async def list(self, *, offset: int, limit: int, active: bool | None = None) -> list[Community]:
        stmt = select(Community)
        if active is not None:
            stmt = stmt.where(Community.is_active.is_(active))
        stmt = self._scoped(stmt).order_by(Community.name).offset(offset).limit(limit)
        return list((await self.db.scalars(stmt)).all())

    async def count(self, *, active: bool | None = None) -> int:
        stmt = select(func.count()).select_from(Community)
        if active is not None:
            stmt = stmt.where(Community.is_active.is_(active))
        return int(await self.db.scalar(self._scoped(stmt)) or 0)

    async def add(self, obj: Community) -> Community:
        self.db.add(obj)
        await self.db.flush()
        return obj


class GateRepository(AsyncTenantRepository[Gate]):
    model = Gate

    async def by_code(self, community_id: uuid.UUID, code: str) -> Gate | None:
        return await self.db.scalar(
            select(Gate).where(Gate.community_id == community_id, Gate.code == code)
        )

    async def list_for_community(
        self, community_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Gate], int]:
        stmt = select(Gate).where(Gate.community_id == community_id).order_by(Gate.code)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )


class TowerRepository(AsyncTenantRepository[Tower]):
    model = Tower

    async def by_name(self, community_id: uuid.UUID, name: str) -> Tower | None:
        return await self.db.scalar(
            select(Tower).where(Tower.community_id == community_id, Tower.name == name)
        )

    async def list_for_community(
        self, community_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Tower], int]:
        stmt = select(Tower).where(Tower.community_id == community_id).order_by(Tower.name)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )


class FloorRepository(AsyncTenantRepository[Floor]):
    model = Floor

    async def list_for_tower(
        self, tower_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Floor], int]:
        stmt = select(Floor).where(Floor.tower_id == tower_id).order_by(Floor.floor_number)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )

    async def by_number(
        self, *, community_id: uuid.UUID, tower_id: uuid.UUID, number: int
    ) -> Floor | None:
        return await self.db.scalar(
            select(Floor).where(
                Floor.community_id == community_id,
                Floor.tower_id == tower_id,
                Floor.floor_number == number,
            )
        )


class UnitRepository(AsyncTenantRepository[Unit]):
    model = Unit

    async def list_for_floor(
        self, floor_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Unit], int]:
        stmt = select(Unit).where(Unit.floor_id == floor_id).order_by(Unit.unit_number)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )

    async def list_for_community(
        self,
        community_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        tower_id: uuid.UUID | None = None,
        floor_id: uuid.UUID | None = None,
        unit_type: str | None = None,
        active: bool | None = None,
    ) -> tuple[list[Unit], int]:
        stmt = select(Unit).where(Unit.community_id == community_id)
        if tower_id is not None:
            stmt = stmt.where(Unit.tower_id == tower_id)
        if floor_id is not None:
            stmt = stmt.where(Unit.floor_id == floor_id)
        if unit_type is not None:
            stmt = stmt.where(Unit.unit_type == unit_type)
        if active is not None:
            stmt = stmt.where(Unit.is_active.is_(active))
        stmt = stmt.order_by(Unit.unit_number)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )

    async def by_number(
        self, *, community_id: uuid.UUID, tower_id: uuid.UUID, number: str
    ) -> Unit | None:
        return await self.db.scalar(
            select(Unit).where(
                Unit.community_id == community_id,
                Unit.tower_id == tower_id,
                Unit.unit_number == number,
            )
        )


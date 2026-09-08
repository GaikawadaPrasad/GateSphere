"""Business logic for Community & Property (FR-03).

Rules:
  * Only a global (Super Admin) scope may create or hard-delete a `community`.
  * Towers / floors / units / gates are created in the caller's **active community** (resolved
    from scope, never from the payload). `scope.require()` yields the community id or 404s.
  * `floor.tower` and `unit.floor` must resolve within the same community (else 404 — cross-tenant
    references are never distinguished from "not found").
  * `is_active=False` is a soft disable; hard delete cascades and is Super-Admin only.
  * Every write emits an audit row in the same transaction.

Async stack (ADR-010).
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities import schemas
from app.modules.communities.models import Community, Floor, Gate, Tower, Unit
from app.modules.communities.repository import (
    CommunityRepository,
    FloorRepository,
    GateRepository,
    TowerRepository,
    UnitRepository,
)
from app.modules.communities.schemas import ALLOWED
from app.modules.users.models import User


def _check_enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


def _apply(obj: object, patch: dict) -> None:
    for key, value in patch.items():
        setattr(obj, key, value)


def _snapshot(obj: object, keys: dict) -> dict:
    return {k: getattr(obj, k, None) for k in keys}


class CommunityService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ) -> None:
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.communities = CommunityRepository(db, scope)
        self.gates = GateRepository(db, scope)
        self.towers = TowerRepository(db, scope)
        self.floors = FloorRepository(db, scope)
        self.units = UnitRepository(db, scope)

    async def _audit(self, action: str, community_id, entity_type, entity_id, **kw) -> None:
        await record_audit_async(
            self.db,
            module="communities",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            ctx=self.ctx,
            **kw,
        )

    # -- communities ------------------------------------------------------ #
    async def list_communities(
        self, *, offset: int, limit: int, active: bool | None
    ) -> tuple[list[Community], int]:
        return (
            await self.communities.list(offset=offset, limit=limit, active=active),
            await self.communities.count(active=active),
        )

    async def get_community(self, community_id: uuid.UUID) -> Community:
        obj = await self.communities.get(community_id)
        if obj is None:
            raise NotFoundError("Community not found")
        return obj

    async def create_community(self, payload: schemas.CommunityCreate) -> Community:
        if not self.scope.is_global:
            raise ForbiddenError("Only a platform admin can create a community", code="GLOBAL_ONLY")
        code = payload.code.lower()
        if await self.communities.get_by_code(code):
            raise ConflictError(
                "Community code already in use",
                code="COMMUNITY_CODE_TAKEN",
                fields={"code": "taken"},
            )
        obj = Community(**payload.model_dump(exclude={"code"}), code=code)
        await self.communities.add(obj)
        await self._audit("community.create", obj.id, "community", obj.id, new=payload.model_dump())
        return obj

    async def update_community(
        self, community_id: uuid.UUID, payload: schemas.CommunityUpdate
    ) -> Community:
        obj = await self.get_community(community_id)
        patch = payload.model_dump(exclude_unset=True)
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        await self.db.flush()
        await self._audit("community.update", obj.id, "community", obj.id, old=before, new=patch)
        return obj

    async def delete_community(self, community_id: uuid.UUID) -> None:
        if not self.scope.is_global:
            raise ForbiddenError("Only a platform admin can delete a community", code="GLOBAL_ONLY")
        obj = await self.get_community(community_id)
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("community.delete", community_id, "community", community_id)

    # -- gates ---------------------------------------------------------- #
    async def list_gates(
        self, *, community_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Gate], int]:
        cid = self.scope.require(community_id)
        return await self.gates.list_for_community(cid, offset=offset, limit=limit)

    async def get_gate(self, gate_id: uuid.UUID) -> Gate:
        obj = await self.gates.get(gate_id)
        if obj is None:
            raise NotFoundError("Gate not found")
        return obj

    async def create_gate(self, *, community_id: uuid.UUID, payload: schemas.GateCreate) -> Gate:
        cid = self.scope.require(community_id)
        _check_enum("gate_type", payload.gate_type)
        if await self.gates.by_code(cid, payload.code):
            raise ConflictError(
                "Gate code already in use", code="GATE_CODE_TAKEN", fields={"code": "taken"}
            )
        obj = Gate(community_id=cid, **payload.model_dump())
        await self.gates.add(obj)
        await self._audit("gate.create", cid, "gate", obj.id, new=payload.model_dump())
        return obj

    async def update_gate(self, gate_id: uuid.UUID, payload: schemas.GateUpdate) -> Gate:
        obj = await self.get_gate(gate_id)
        patch = payload.model_dump(exclude_unset=True)
        _check_enum("gate_type", patch.get("gate_type"))
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        await self.db.flush()
        await self._audit("gate.update", obj.community_id, "gate", obj.id, old=before, new=patch)
        return obj

    async def delete_gate(self, gate_id: uuid.UUID) -> None:
        obj = await self.get_gate(gate_id)
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("gate.delete", obj.community_id, "gate", gate_id)

    # -- towers ------------------------------------------------------- #
    async def list_towers(
        self, *, community_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Tower], int]:
        cid = self.scope.require(community_id)
        return await self.towers.list_for_community(cid, offset=offset, limit=limit)

    async def get_tower(self, tower_id: uuid.UUID) -> Tower:
        obj = await self.towers.get(tower_id)
        if obj is None:
            raise NotFoundError("Tower not found")
        return obj

    async def create_tower(self, *, community_id: uuid.UUID, payload: schemas.TowerCreate) -> Tower:
        cid = self.scope.require(community_id)
        _check_enum("structure_type", payload.structure_type)
        if await self.towers.by_name(cid, payload.name):
            raise ConflictError(
                "Tower name already in use", code="TOWER_NAME_TAKEN", fields={"name": "taken"}
            )
        obj = Tower(community_id=cid, **payload.model_dump())
        await self.towers.add(obj)
        await self._audit("tower.create", cid, "tower", obj.id, new=payload.model_dump())
        return obj

    async def update_tower(self, tower_id: uuid.UUID, payload: schemas.TowerUpdate) -> Tower:
        obj = await self.get_tower(tower_id)
        patch = payload.model_dump(exclude_unset=True)
        _check_enum("structure_type", patch.get("structure_type"))
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        await self.db.flush()
        await self._audit("tower.update", obj.community_id, "tower", obj.id, old=before, new=patch)
        return obj

    async def delete_tower(self, tower_id: uuid.UUID) -> None:
        obj = await self.get_tower(tower_id)
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("tower.delete", obj.community_id, "tower", tower_id)

    # -- floors ---------------------------------------------------- #
    async def list_floors(
        self, *, tower_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Floor], int]:
        tower = await self.get_tower(tower_id)
        return await self.floors.list_for_tower(tower.id, offset=offset, limit=limit)

    async def get_floor(self, floor_id: uuid.UUID) -> Floor:
        obj = await self.floors.get(floor_id)
        if obj is None:
            raise NotFoundError("Floor not found")
        return obj

    async def create_floor(self, payload: schemas.FloorCreate) -> Floor:
        tower = await self.get_tower(payload.tower_id)  # 404 if tower outside scope
        if await self.floors.by_number(
            community_id=tower.community_id, tower_id=tower.id, number=payload.floor_number
        ):
            raise ConflictError(
                "Floor number already exists in this tower",
                code="FLOOR_NUMBER_TAKEN",
                fields={"floor_number": "taken"},
            )
        obj = Floor(
            community_id=tower.community_id,
            tower_id=tower.id,
            floor_number=payload.floor_number,
            label=payload.label,
        )
        await self.floors.add(obj)
        tower.total_floors = max(tower.total_floors, payload.floor_number)
        await self.db.flush()
        await self._audit(
            "floor.create", tower.community_id, "floor", obj.id, new=payload.model_dump()
        )
        return obj

    async def update_floor(self, floor_id: uuid.UUID, payload: schemas.FloorUpdate) -> Floor:
        obj = await self.get_floor(floor_id)
        patch = payload.model_dump(exclude_unset=True)
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        await self.db.flush()
        await self._audit("floor.update", obj.community_id, "floor", obj.id, old=before, new=patch)
        return obj

    async def delete_floor(self, floor_id: uuid.UUID) -> None:
        obj = await self.get_floor(floor_id)
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("floor.delete", obj.community_id, "floor", floor_id)

    # -- units --------------------------------------------------- #
    async def list_units(
        self, *, floor_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Unit], int]:
        floor = await self.get_floor(floor_id)
        return await self.units.list_for_floor(floor.id, offset=offset, limit=limit)

    async def list_community_units(
        self,
        *,
        community_id: uuid.UUID,
        offset: int,
        limit: int,
        tower_id: uuid.UUID | None = None,
        floor_id: uuid.UUID | None = None,
        unit_type: str | None = None,
        active: bool | None = None,
    ) -> tuple[list[Unit], int]:
        cid = self.scope.require(community_id)
        if unit_type is not None:
            _check_enum("unit_type", unit_type)
        return await self.units.list_for_community(
            cid,
            offset=offset,
            limit=limit,
            tower_id=tower_id,
            floor_id=floor_id,
            unit_type=unit_type,
            active=active,
        )

    async def get_unit(self, unit_id: uuid.UUID) -> Unit:
        obj = await self.units.get(unit_id)
        if obj is None:
            raise NotFoundError("Unit not found")
        return obj

    async def create_unit(self, payload: schemas.UnitCreate) -> Unit:
        floor = await self.get_floor(payload.floor_id)  # 404 if floor outside scope
        _check_enum("unit_type", payload.unit_type)
        if await self.units.by_number(
            community_id=floor.community_id,
            tower_id=floor.tower_id,
            number=payload.unit_number,
        ):
            raise ConflictError(
                "Unit number already exists in this tower",
                code="UNIT_NUMBER_TAKEN",
                fields={"unit_number": "taken"},
            )
        obj = Unit(
            community_id=floor.community_id,
            tower_id=floor.tower_id,
            floor_id=floor.id,
            unit_number=payload.unit_number,
            unit_type=payload.unit_type,
            bedrooms=payload.bedrooms,
            area_sqft=payload.area_sqft,
        )
        await self.units.add(obj)
        await self._audit(
            "unit.create", floor.community_id, "unit", obj.id, new=payload.model_dump()
        )
        return obj

    async def update_unit(self, unit_id: uuid.UUID, payload: schemas.UnitUpdate) -> Unit:
        obj = await self.get_unit(unit_id)
        patch = payload.model_dump(exclude_unset=True)
        _check_enum("unit_type", patch.get("unit_type"))
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        await self.db.flush()
        await self._audit("unit.update", obj.community_id, "unit", obj.id, old=before, new=patch)
        return obj

    async def delete_unit(self, unit_id: uuid.UUID) -> None:
        obj = await self.get_unit(unit_id)
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("unit.delete", obj.community_id, "unit", unit_id)

"""Business logic for Community & Property (FR-03).

Rules:
  * Only a global (Super Admin) scope may create or hard-delete a `community`.
  * Towers / floors / units / gates are created in the caller's **active community** (resolved
    from scope, never from the payload). `scope.require()` yields the community id or 404s.
  * `floor.tower` and `unit.floor` must resolve within the same community (else 404 — cross-tenant
    references are never distinguished from "not found").
  * `is_active=False` is a soft disable; hard delete cascades and is Super-Admin only.
  * Every write emits an audit row in the same transaction.
"""

from __future__ import annotations

import uuid

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
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


class CommunityService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ) -> None:
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.communities = CommunityRepository(db, scope)
        self.gates = GateRepository(db, scope)
        self.towers = TowerRepository(db, scope)
        self.floors = FloorRepository(db, scope)
        self.units = UnitRepository(db, scope)

    # -- communities ------------------------------------------------------ #
    def list_communities(
        self, *, offset: int, limit: int, active: bool | None
    ) -> tuple[list[Community], int]:
        return (
            self.communities.list(offset=offset, limit=limit, active=active),
            self.communities.count(active=active),
        )

    def get_community(self, community_id: uuid.UUID) -> Community:
        obj = self.communities.get(community_id)
        if obj is None:
            raise NotFoundError("Community not found")
        return obj

    def create_community(self, payload: schemas.CommunityCreate) -> Community:
        if not self.scope.is_global:
            raise ForbiddenError("Only a platform admin can create a community", code="GLOBAL_ONLY")
        code = payload.code.lower()
        if self.communities.get_by_code(code):
            raise ConflictError(
                "Community code already in use",
                code="COMMUNITY_CODE_TAKEN",
                fields={"code": "taken"},
            )
        obj = Community(**payload.model_dump(exclude={"code"}), code=code)
        self.communities.add(obj)
        record_audit(
            self.db,
            module="communities",
            action="community.create",
            actor=self.actor,
            community_id=obj.id,
            entity_type="community",
            entity_id=obj.id,
            new=payload.model_dump(),
            request=self.request,
        )
        return obj

    def update_community(
        self, community_id: uuid.UUID, payload: schemas.CommunityUpdate
    ) -> Community:
        obj = self.get_community(community_id)
        patch = payload.model_dump(exclude_unset=True)
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        self.db.flush()
        record_audit(
            self.db,
            module="communities",
            action="community.update",
            actor=self.actor,
            community_id=obj.id,
            entity_type="community",
            entity_id=obj.id,
            old=before,
            new=patch,
            request=self.request,
        )
        return obj

    def delete_community(self, community_id: uuid.UUID) -> None:
        if not self.scope.is_global:
            raise ForbiddenError("Only a platform admin can delete a community", code="GLOBAL_ONLY")
        obj = self.get_community(community_id)
        self.db.delete(obj)
        self.db.flush()
        record_audit(
            self.db,
            module="communities",
            action="community.delete",
            actor=self.actor,
            community_id=community_id,
            entity_type="community",
            entity_id=community_id,
            request=self.request,
        )

    # -- gates ---------------------------------------------------------- #
    def list_gates(
        self, *, community_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Gate], int]:
        cid = self.scope.require(community_id)
        from sqlalchemy import select

        stmt = select(Gate).where(Gate.community_id == cid).order_by(Gate.code)
        return self.gates.list(offset=offset, limit=limit, extra=stmt), self.gates.count(extra=stmt)

    def create_gate(self, *, community_id: uuid.UUID, payload: schemas.GateCreate) -> Gate:
        cid = self.scope.require(community_id)
        _check_enum("gate_type", payload.gate_type)
        if self.gates.by_code(cid, payload.code):
            raise ConflictError(
                "Gate code already in use", code="GATE_CODE_TAKEN", fields={"code": "taken"}
            )
        obj = Gate(community_id=cid, **payload.model_dump())
        self.gates.add(obj)
        record_audit(
            self.db,
            module="communities",
            action="gate.create",
            actor=self.actor,
            community_id=cid,
            entity_type="gate",
            entity_id=obj.id,
            new=payload.model_dump(),
            request=self.request,
        )
        return obj

    # -- towers ------------------------------------------------------- #
    def list_towers(
        self, *, community_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Tower], int]:
        cid = self.scope.require(community_id)
        from sqlalchemy import select

        stmt = select(Tower).where(Tower.community_id == cid).order_by(Tower.name)
        return self.towers.list(offset=offset, limit=limit, extra=stmt), self.towers.count(
            extra=stmt
        )

    def get_tower(self, tower_id: uuid.UUID) -> Tower:
        obj = self.towers.get(tower_id)
        if obj is None:
            raise NotFoundError("Tower not found")
        return obj

    def create_tower(self, *, community_id: uuid.UUID, payload: schemas.TowerCreate) -> Tower:
        cid = self.scope.require(community_id)
        _check_enum("structure_type", payload.structure_type)
        if self.towers.by_name(cid, payload.name):
            raise ConflictError(
                "Tower name already in use", code="TOWER_NAME_TAKEN", fields={"name": "taken"}
            )
        obj = Tower(community_id=cid, **payload.model_dump())
        self.towers.add(obj)
        record_audit(
            self.db,
            module="communities",
            action="tower.create",
            actor=self.actor,
            community_id=cid,
            entity_type="tower",
            entity_id=obj.id,
            new=payload.model_dump(),
            request=self.request,
        )
        return obj

    def update_tower(self, tower_id: uuid.UUID, payload: schemas.TowerUpdate) -> Tower:
        obj = self.get_tower(tower_id)
        patch = payload.model_dump(exclude_unset=True)
        _check_enum("structure_type", patch.get("structure_type"))
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        self.db.flush()
        record_audit(
            self.db,
            module="communities",
            action="tower.update",
            actor=self.actor,
            community_id=obj.community_id,
            entity_type="tower",
            entity_id=obj.id,
            old=before,
            new=patch,
            request=self.request,
        )
        return obj

    # -- floors ---------------------------------------------------- #
    def list_floors(
        self, *, tower_id: uuid.UUID, offset: int, limit: int
    ) -> tuple[list[Floor], int]:
        tower = self.get_tower(tower_id)
        from sqlalchemy import select

        stmt = select(Floor).where(Floor.tower_id == tower.id).order_by(Floor.floor_number)
        return self.floors.list(offset=offset, limit=limit, extra=stmt), self.floors.count(
            extra=stmt
        )

    def get_floor(self, floor_id: uuid.UUID) -> Floor:
        obj = self.floors.get(floor_id)
        if obj is None:
            raise NotFoundError("Floor not found")
        return obj

    def create_floor(self, payload: schemas.FloorCreate) -> Floor:
        tower = self.get_tower(payload.tower_id)  # 404 if tower outside scope
        if self.floors.by_number(
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
        self.floors.add(obj)
        tower.total_floors = max(tower.total_floors, payload.floor_number)
        self.db.flush()
        record_audit(
            self.db,
            module="communities",
            action="floor.create",
            actor=self.actor,
            community_id=tower.community_id,
            entity_type="floor",
            entity_id=obj.id,
            new=payload.model_dump(),
            request=self.request,
        )
        return obj

    # -- units --------------------------------------------------- #
    def list_units(self, *, floor_id: uuid.UUID, offset: int, limit: int) -> tuple[list[Unit], int]:
        floor = self.get_floor(floor_id)
        from sqlalchemy import select

        stmt = select(Unit).where(Unit.floor_id == floor.id).order_by(Unit.unit_number)
        return self.units.list(offset=offset, limit=limit, extra=stmt), self.units.count(extra=stmt)

    def get_unit(self, unit_id: uuid.UUID) -> Unit:
        obj = self.units.get(unit_id)
        if obj is None:
            raise NotFoundError("Unit not found")
        return obj

    def create_unit(self, payload: schemas.UnitCreate) -> Unit:
        floor = self.get_floor(payload.floor_id)  # 404 if floor outside scope
        _check_enum("unit_type", payload.unit_type)
        if self.units.by_number(
            community_id=floor.community_id,
            tower_id=floor.tower_id,
            floor_id=floor.id,
            number=payload.unit_number,
        ):
            raise ConflictError(
                "Unit number already exists on this floor",
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
        self.units.add(obj)
        record_audit(
            self.db,
            module="communities",
            action="unit.create",
            actor=self.actor,
            community_id=floor.community_id,
            entity_type="unit",
            entity_id=obj.id,
            new=payload.model_dump(),
            request=self.request,
        )
        return obj

    def update_unit(self, unit_id: uuid.UUID, payload: schemas.UnitUpdate) -> Unit:
        obj = self.get_unit(unit_id)
        patch = payload.model_dump(exclude_unset=True)
        _check_enum("unit_type", patch.get("unit_type"))
        before = _snapshot(obj, patch)
        _apply(obj, patch)
        self.db.flush()
        record_audit(
            self.db,
            module="communities",
            action="unit.update",
            actor=self.actor,
            community_id=obj.community_id,
            entity_type="unit",
            entity_id=obj.id,
            old=before,
            new=patch,
            request=self.request,
        )
        return obj


def _snapshot(obj: object, keys: dict) -> dict:
    return {k: getattr(obj, k, None) for k in keys}

"""Business logic for Vehicle & Parking (FR-08).

- Vehicle owner is resident XOR visitor (also a DB CHECK).
- One active allocation per slot and per vehicle; `max_active_slots_per_unit` from
  `parking_rules` (config-as-data) caps a unit.
- Gate entry logs by plate; an unknown plate is flagged. One open entry per plate.
- Violations: open -> acknowledged -> resolved / waived.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Gate
from app.modules.uploads.guard import ensure_confirmed_async
from app.modules.users.models import User
from app.modules.vehicles import schemas
from app.modules.vehicles.models import (
    ParkingAllocation,
    ParkingRule,
    ParkingSlot,
    ParkingViolation,
    Vehicle,
    VehicleEntry,
)
from app.modules.vehicles.repository import (
    AllocationRepository,
    EntryRepository,
    RuleRepository,
    SlotRepository,
    VehicleRepository,
    ViolationRepository,
)
from app.modules.vehicles.schemas import ALLOWED

_DEFAULT_RULE = {
    "allow_multi_slot_vehicle": False,
    "allow_guest_parking": True,
    "max_active_slots_per_unit": 2,
    "violation_grace_minutes": 30,
}
_VIOLATION_TRANSITIONS = {
    "open": {"acknowledged", "resolved", "waived"},
    "acknowledged": {"resolved", "waived"},
    "resolved": set(),
    "waived": set(),
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class VehicleService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.vehicles = VehicleRepository(db, scope)
        self.slots = SlotRepository(db, scope)
        self.allocations = AllocationRepository(db, scope)
        self.entries = EntryRepository(db, scope)
        self.rules = RuleRepository(db, scope)
        self.violations = ViolationRepository(db, scope)

    async def _audit(self, action, community_id, entity_type, entity_id, **kw):
        await record_audit_async(
            self.db,
            module="vehicles",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            ctx=self.ctx,
            **kw,
        )

    def _one_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    async def _gate_in_scope(self, gate_id: uuid.UUID | None) -> uuid.UUID | None:
        if gate_id is None:
            return None
        stmt = select(Gate).where(Gate.id == gate_id)
        if not self.scope.is_global:
            stmt = stmt.where(Gate.community_id.in_(self.scope.community_ids))
        gate = await self.db.scalar(stmt)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.id

    async def _rule(self, community_id: uuid.UUID) -> ParkingRule:
        obj = await self.rules.for_community(community_id)
        if obj is None:
            obj = ParkingRule(community_id=community_id, **_DEFAULT_RULE)
            await self.rules.add(obj)
        return obj

    # -- rules --------------------------------------------------- #
    async def get_rule(self, *, community_id: uuid.UUID | None) -> ParkingRule:
        return await self._rule(self._one_community(community_id))

    async def update_rule(self, payload: schemas.RuleUpdate, *, community_id: uuid.UUID | None):
        obj = await self._rule(self._one_community(community_id))
        patch = payload.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("rule.update", obj.community_id, "parking_rule", obj.id, new=patch)
        return obj

    # -- vehicles --------------------------------------------- #
    async def register_vehicle(
        self, payload: schemas.VehicleCreate, *, community_id: uuid.UUID | None
    ):
        cid = self._one_community(community_id)
        _enum("vehicle_type", payload.vehicle_type)
        plate = payload.registration_number.upper()
        if await self.vehicles.by_plate(cid, plate):
            raise ConflictError("That plate is already registered", code="VEHICLE_EXISTS")
        obj = Vehicle(
            community_id=cid,
            resident_profile_id=payload.resident_profile_id,
            visitor_id=payload.visitor_id,
            unit_id=payload.unit_id,
            vehicle_type=payload.vehicle_type,
            registration_number=plate,
            make=payload.make,
            model=payload.model,
            color=payload.color,
            sticker_number=payload.sticker_number,
        )
        await self.vehicles.add(obj)
        await self._audit("vehicle.register", cid, "vehicle", obj.id, new={"plate": plate})
        return obj

    async def get_vehicle(self, vehicle_id: uuid.UUID) -> Vehicle:
        obj = await self.vehicles.get(vehicle_id)
        if obj is None:
            raise NotFoundError("Vehicle not found")
        return obj

    async def update_vehicle(
        self, vehicle_id: uuid.UUID, payload: schemas.VehicleUpdate
    ) -> Vehicle:
        obj = await self.get_vehicle(vehicle_id)
        patch = payload.model_dump(exclude_unset=True)
        _enum("vehicle_type", patch.get("vehicle_type"))
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("vehicle.update", obj.community_id, "vehicle", obj.id, new=patch)
        return obj

    async def list_vehicles(
        self, *, community_id: uuid.UUID | None, q: str | None, offset: int, limit: int
    ):
        cid = self._one_community(community_id)
        stmt = select(Vehicle).where(Vehicle.community_id == cid)
        if q:
            stmt = stmt.where(Vehicle.registration_number.ilike(f"%{q.upper()}%"))
        stmt = stmt.order_by(Vehicle.registration_number)
        return await self.vehicles.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.vehicles.count(extra=stmt)

    # -- slots ----------------------------------------------- #
    async def create_slot(self, payload: schemas.SlotCreate, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        _enum("slot_type", payload.slot_type)
        if await self.slots.by_code(cid, payload.slot_code):
            raise ConflictError("That slot code exists", code="SLOT_EXISTS")
        obj = ParkingSlot(
            community_id=cid,
            tower_id=payload.tower_id,
            slot_code=payload.slot_code,
            slot_type=payload.slot_type,
            level=payload.level,
            is_guest_slot=payload.is_guest_slot,
            reserved_for_unit_id=payload.reserved_for_unit_id,
        )
        await self.slots.add(obj)
        await self._audit("slot.create", cid, "parking_slot", obj.id)
        return obj

    async def list_slots(
        self,
        *,
        community_id: uuid.UUID | None,
        slot_status: str | None,
        offset: int,
        limit: int,
    ):
        _enum("slot_status", slot_status)
        cid = self._one_community(community_id)
        stmt = select(ParkingSlot).where(ParkingSlot.community_id == cid)
        if slot_status:
            stmt = stmt.where(ParkingSlot.status == slot_status)
        stmt = stmt.order_by(ParkingSlot.slot_code)
        return await self.slots.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.slots.count(extra=stmt)

    # -- allocations ------------------------------------- #
    async def allocate(self, payload: schemas.AllocationCreate) -> ParkingAllocation:
        slot = await self.slots.get(payload.slot_id)
        if slot is None:
            raise NotFoundError("Slot not found")
        vehicle = await self.vehicles.get(payload.vehicle_id)
        if vehicle is None or vehicle.community_id != slot.community_id:
            raise NotFoundError("Vehicle not found")
        rule = await self._rule(slot.community_id)
        if await self.allocations.active_for_slot(slot.id):
            raise ConflictError("Slot is already allocated", code="SLOT_TAKEN")
        if not rule.allow_multi_slot_vehicle and await self.allocations.active_for_vehicle(
            vehicle.id
        ):
            raise ConflictError("Vehicle already has a slot", code="VEHICLE_HAS_SLOT")
        unit_id = payload.unit_id or vehicle.unit_id
        if unit_id is not None:
            in_use = await self.allocations.active_count_for_unit(unit_id)
            if in_use >= rule.max_active_slots_per_unit:
                raise BusinessRuleError("Unit has reached its slot limit", code="UNIT_SLOT_LIMIT")
        obj = ParkingAllocation(
            community_id=slot.community_id,
            slot_id=slot.id,
            vehicle_id=vehicle.id,
            unit_id=unit_id,
            allocated_to=payload.allocated_to,
            allocated_by_user_id=self.actor.id,
        )
        await self.allocations.add(obj)
        slot.status = "allocated"
        await self.db.flush()
        await self._audit("allocation.create", slot.community_id, "parking_allocation", obj.id)
        return obj

    async def release(self, allocation_id: uuid.UUID) -> ParkingAllocation:
        obj = await self.allocations.get(allocation_id)
        if obj is None:
            raise NotFoundError("Allocation not found")
        if obj.status != "active":
            raise BusinessRuleError("Allocation already released", code="ALREADY_RELEASED")
        obj.status = "released"
        obj.allocated_to = obj.allocated_to or datetime.now(UTC)
        slot = await self.db.get(ParkingSlot, obj.slot_id)
        if slot is not None:
            slot.status = "available"
        await self.db.flush()
        await self._audit("allocation.release", obj.community_id, "parking_allocation", obj.id)
        return obj

    async def list_allocations(
        self,
        *,
        community_id: uuid.UUID | None,
        active_only: bool,
        offset: int,
        limit: int,
    ):
        stmt = select(ParkingAllocation)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(ParkingAllocation.community_id == community_id)
        if active_only:
            stmt = stmt.where(ParkingAllocation.status == "active")
        stmt = stmt.order_by(ParkingAllocation.allocated_from.desc())
        return await self.allocations.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.allocations.count(extra=stmt)

    # -- gate entries ---------------------------------- #
    async def record_entry(self, payload: schemas.EntryCreate, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        _enum("source_type", payload.source_type)
        plate = payload.registration_number.upper()
        if await self.entries.open_for_plate(cid, plate):
            raise ConflictError("That vehicle is already inside", code="ALREADY_INSIDE")
        vehicle = await self.vehicles.by_plate(cid, plate)
        obj = VehicleEntry(
            community_id=cid,
            vehicle_id=vehicle.id if vehicle else None,
            registration_number=plate,
            gate_id=await self._gate_in_scope(payload.gate_id),
            entry_guard_user_id=self.actor.id,
            source_type=payload.source_type,
            reference_id=payload.reference_id,
            status="inside",
            is_flagged=vehicle is None,
        )
        await self.entries.add(obj)
        await self._audit(
            "entry.create", cid, "vehicle_entry", obj.id, new={"flagged": obj.is_flagged}
        )
        return obj

    async def record_exit(self, entry_id: uuid.UUID) -> VehicleEntry:
        obj = await self.entries.get(entry_id)
        if obj is None:
            raise NotFoundError("Entry not found")
        if obj.status != "inside":
            raise BusinessRuleError("Entry is not open", code="NOT_INSIDE")
        obj.status = "exited"
        obj.exit_at = datetime.now(UTC)
        obj.exit_guard_user_id = self.actor.id
        await self.db.flush()
        await self._audit("entry.exit", obj.community_id, "vehicle_entry", obj.id)
        return obj

    async def list_entries(
        self,
        *,
        community_id: uuid.UUID | None,
        plate: str | None,
        open_only: bool,
        offset: int,
        limit: int,
    ):
        stmt = select(VehicleEntry)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(VehicleEntry.community_id == community_id)
        if plate:
            stmt = stmt.where(VehicleEntry.registration_number == plate.upper())
        if open_only:
            stmt = stmt.where(VehicleEntry.status == "inside")
        stmt = stmt.order_by(VehicleEntry.entry_at.desc())
        return await self.entries.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.entries.count(extra=stmt)

    # -- violations ---------------------------------- #
    async def report_violation(
        self, payload: schemas.ViolationCreate, *, community_id: uuid.UUID | None
    ):
        cid = self._one_community(community_id)
        _enum("violation_type", payload.violation_type)
        await ensure_confirmed_async(self.db, payload.evidence_url)
        obj = ParkingViolation(
            community_id=cid,
            vehicle_id=payload.vehicle_id,
            parking_slot_id=payload.parking_slot_id,
            reported_by_user_id=self.actor.id,
            violation_type=payload.violation_type,
            description=payload.description,
            evidence_url=payload.evidence_url,
            fine_amount=payload.fine_amount,
        )
        await self.violations.add(obj)
        await self._audit("violation.report", cid, "parking_violation", obj.id)
        return obj

    async def transition_violation(
        self, violation_id: uuid.UUID, new_status: str
    ) -> ParkingViolation:
        obj = await self.violations.get(violation_id)
        if obj is None:
            raise NotFoundError("Violation not found")
        _enum("violation_status", new_status)
        if new_status not in _VIOLATION_TRANSITIONS[obj.status]:
            raise BusinessRuleError(
                f"Cannot move a '{obj.status}' violation to '{new_status}'",
                code="INVALID_TRANSITION",
            )
        obj.status = new_status
        if new_status in ("resolved", "waived"):
            obj.resolved_at = datetime.now(UTC)
        await self.db.flush()
        await self._audit(f"violation.{new_status}", obj.community_id, "parking_violation", obj.id)
        return obj

    async def list_violations(
        self,
        *,
        community_id: uuid.UUID | None,
        violation_status: str | None,
        offset: int,
        limit: int,
    ):
        _enum("violation_status", violation_status)
        stmt = select(ParkingViolation)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(ParkingViolation.community_id == community_id)
        if violation_status:
            stmt = stmt.where(ParkingViolation.status == violation_status)
        stmt = stmt.order_by(ParkingViolation.occurred_at.desc())
        return await self.violations.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.violations.count(extra=stmt)

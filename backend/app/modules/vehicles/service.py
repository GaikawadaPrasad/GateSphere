"""Business logic for Vehicle & Parking (FR-08).

- Vehicle owner is resident XOR visitor (also a DB CHECK).
- One active allocation per slot and per vehicle; `max_active_slots_per_unit` from
  `parking_rules` (config-as-data) caps a unit. Blocked / other-unit-reserved slots and
  deactivated vehicles cannot be allocated.
- Gate entry logs by plate; an unknown plate is flagged (supervisors notified). One open
  entry per plate. A plate linked to a blacklisted visitor is intercepted *before* the
  entry is recorded (`visitor_policies.blacklist_mode`: block rejects, warn flags).
- Violations: open -> acknowledged -> resolved / waived. The observed plate is kept and
  auto-matched to a registered vehicle; the owning resident is notified.
- Gate operations (entry/exit), allocation release, violation transitions and fines are
  staff-only: a unit-restricted actor (plain resident) gets 403 `STAFF_ONLY`. A resident
  sees only their own unit's vehicles, allocations, gate history and violations.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.repository import gate_in_scope
from app.modules.notifications import events as notif_events
from app.modules.residents.access import UnitScopedAccess
from app.modules.residents.models import ResidentProfile
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
from app.modules.vehicles.schemas import ALLOWED, plate_search_term

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


class VehicleService(UnitScopedAccess):
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

    async def _audit(
        self,
        action: str,
        community_id: uuid.UUID | None,
        entity_type: str,
        entity_id: uuid.UUID | str,
        **kw: Any,
    ) -> None:
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

    async def _require_staff(self, community_id: uuid.UUID, what: str) -> None:
        """Gate / parking operations belong to community staff, never a plain resident —
        `vehicles:create/update` is granted to residents for their *own* registry only."""
        if await self.is_unit_restricted(community_id):
            raise ForbiddenError(f"Only community staff can {what}", code="STAFF_ONLY")

    async def _vehicle_in(self, community_id: uuid.UUID, vehicle_id: uuid.UUID) -> Vehicle:
        vehicle = await self.vehicles.get(vehicle_id)
        if vehicle is None or vehicle.community_id != community_id:
            raise NotFoundError("Vehicle not found")
        return vehicle

    async def _slot_in(self, community_id: uuid.UUID, slot_id: uuid.UUID) -> ParkingSlot:
        slot = await self.slots.get(slot_id)
        if slot is None or slot.community_id != community_id:
            raise NotFoundError("Slot not found")
        return slot

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
        gate = await gate_in_scope(self.db, self.scope, gate_id)
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

    async def update_rule(
        self, payload: schemas.RuleUpdate, *, community_id: uuid.UUID | None
    ) -> ParkingRule:
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
    ) -> Vehicle:
        cid = self._one_community(community_id)
        _enum("vehicle_type", payload.vehicle_type)
        plate = payload.registration_number  # normalized by the schema
        if await self.vehicles.by_plate(cid, plate):
            raise ConflictError("That plate is already registered", code="VEHICLE_EXISTS")

        if await self.is_unit_restricted():
            if payload.unit_id is not None:
                await self._assert_unit_visible(payload.unit_id)
            else:
                scope = await self._unit_scope()
                if scope and len(scope) == 1:
                    payload.unit_id = next(iter(scope))
                else:
                    raise BusinessRuleError(
                        "Specify your unit", code="UNIT_REQUIRED", fields={"unit_id": "required"}
                    )

            if payload.resident_profile_id is None and payload.visitor_id is None:
                prof_id = await self.db.scalar(
                    select(ResidentProfile.id).where(
                        ResidentProfile.user_id == self.actor.id,
                        ResidentProfile.community_id == cid,
                    )
                )
                if prof_id is not None:
                    payload.resident_profile_id = prof_id

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
        if await self.is_unit_restricted():
            await self._assert_unit_visible(obj.unit_id)
        return obj

    async def update_vehicle(
        self, vehicle_id: uuid.UUID, payload: schemas.VehicleUpdate
    ) -> Vehicle:
        obj = await self.get_vehicle(vehicle_id)  # own-unit check for a resident
        patch = payload.model_dump(exclude_unset=True)
        if "unit_id" in patch and await self.is_unit_restricted(obj.community_id):
            # A resident may only move a vehicle between units they occupy.
            await self._assert_unit_visible(patch["unit_id"], obj.community_id)
        _enum("vehicle_type", patch.get("vehicle_type"))
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("vehicle.update", obj.community_id, "vehicle", obj.id, new=patch)
        return obj

    async def list_vehicles(
        self, *, community_id: uuid.UUID | None, q: str | None, offset: int, limit: int
    ) -> tuple[list[Vehicle], int]:
        cid = self._one_community(community_id)
        stmt = select(Vehicle).where(Vehicle.community_id == cid)
        if q:
            stmt = stmt.where(Vehicle.registration_number.ilike(f"%{plate_search_term(q)}%"))
        stmt = await self._scope_unit_column(stmt, Vehicle.unit_id)
        stmt = stmt.order_by(Vehicle.registration_number)
        return await self.vehicles.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.vehicles.count(extra=stmt)

    # -- slots ----------------------------------------------- #
    async def create_slot(
        self, payload: schemas.SlotCreate, *, community_id: uuid.UUID | None
    ) -> ParkingSlot:
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
    ) -> tuple[list[ParkingSlot], int]:
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
        vehicle = await self._vehicle_in(slot.community_id, payload.vehicle_id)
        if not vehicle.is_active:
            raise BusinessRuleError("Vehicle is deactivated", code="VEHICLE_INACTIVE")
        if slot.status == "blocked":
            raise BusinessRuleError("Slot is blocked", code="SLOT_BLOCKED")
        unit_id = payload.unit_id or vehicle.unit_id
        if slot.reserved_for_unit_id is not None and slot.reserved_for_unit_id != unit_id:
            raise BusinessRuleError(
                "Slot is reserved for another unit",
                code="SLOT_RESERVED",
                fields={"slot_id": "reserved for another unit"},
            )
        rule = await self._rule(slot.community_id)
        if await self.allocations.active_for_slot(slot.id):
            raise ConflictError("Slot is already allocated", code="SLOT_TAKEN")
        if not rule.allow_multi_slot_vehicle and await self.allocations.active_for_vehicle(
            vehicle.id
        ):
            raise ConflictError("Vehicle already has a slot", code="VEHICLE_HAS_SLOT")
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
        await self._require_staff(obj.community_id, "release a parking allocation")
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
    ) -> tuple[list[ParkingAllocation], int]:
        stmt = select(ParkingAllocation)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(ParkingAllocation.community_id == community_id)
        if active_only:
            stmt = stmt.where(ParkingAllocation.status == "active")
        stmt = await self._scope_unit_column(stmt, ParkingAllocation.unit_id)
        stmt = stmt.order_by(ParkingAllocation.allocated_from.desc())
        return await self.allocations.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.allocations.count(extra=stmt)

    # -- gate entries ---------------------------------- #
    async def record_entry(
        self, payload: schemas.EntryCreate, *, community_id: uuid.UUID | None
    ) -> VehicleEntry:
        cid = self._one_community(community_id)
        await self._require_staff(cid, "log a gate entry")
        _enum("source_type", payload.source_type)
        plate = payload.registration_number  # normalized by the schema
        # Blacklist interception comes first — before any gate transaction is recorded.
        hit = await self.vehicles.plate_blacklist_hit(cid, plate)
        blacklist_warn = False
        if hit is not None:
            if await self.vehicles.blacklist_mode(cid) == "block":
                raise ForbiddenError(
                    f"Vehicle {plate} is linked to a blacklisted visitor: {hit.reason}",
                    code="PLATE_BLACKLISTED",
                    fields={"reason": hit.reason, "risk_level": hit.risk_level},
                )
            blacklist_warn = True
        if await self.entries.open_for_plate(cid, plate):
            raise ConflictError("That vehicle is already inside", code="ALREADY_INSIDE")
        vehicle = await self.vehicles.by_plate(cid, plate)
        if vehicle is not None and not vehicle.is_active:
            vehicle = None  # a deactivated registration no longer vouches for the plate
        obj = VehicleEntry(
            community_id=cid,
            vehicle_id=vehicle.id if vehicle else None,
            registration_number=plate,
            gate_id=await self._gate_in_scope(payload.gate_id),
            entry_guard_user_id=self.actor.id,
            source_type=payload.source_type,
            reference_id=payload.reference_id,
            status="inside",
            is_flagged=vehicle is None or blacklist_warn,
        )
        await self.entries.add(obj)
        await self._audit(
            "entry.create",
            cid,
            "vehicle_entry",
            obj.id,
            new={"plate": plate, "flagged": obj.is_flagged, "blacklist_warn": blacklist_warn},
        )
        if obj.is_flagged:
            reason = "linked to a blacklisted visitor" if blacklist_warn else "not registered"
            await notif_events.emit_to_roles(
                self.db,
                self.scope,
                self.actor,
                self.ctx,
                community_id=cid,
                role_slugs=["security_supervisor"],
                notification_type="vehicles.entry_flagged",
                title="Flagged vehicle entered",
                message=f"Vehicle {plate} entered the premises — {reason}.",
                reference_type="vehicle_entry",
                reference_id=obj.id,
            )
        return obj

    async def record_exit(self, entry_id: uuid.UUID) -> VehicleEntry:
        obj = await self.entries.get(entry_id)
        if obj is None:
            raise NotFoundError("Entry not found")
        await self._require_staff(obj.community_id, "log a gate exit")
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
        flagged_only: bool = False,
    ) -> tuple[list[VehicleEntry], int]:
        stmt = select(VehicleEntry)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(VehicleEntry.community_id == community_id)
        if plate:
            stmt = stmt.where(
                VehicleEntry.registration_number.ilike(f"%{plate_search_term(plate)}%")
            )
        if open_only:
            stmt = stmt.where(VehicleEntry.status == "inside")
        if flagged_only:
            stmt = stmt.where(VehicleEntry.is_flagged.is_(True))
        # A resident sees only the gate history of vehicles registered to their unit(s).
        unit_scope = await self._unit_scope(community_id)
        if unit_scope is not None:
            stmt = stmt.where(VehicleEntry.vehicle_id.in_(self.vehicles.ids_for_units(unit_scope)))
        stmt = stmt.order_by(VehicleEntry.entry_at.desc())
        return await self.entries.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.entries.count(extra=stmt)

    # -- violations ---------------------------------- #
    async def report_violation(
        self, payload: schemas.ViolationCreate, *, community_id: uuid.UUID | None
    ) -> ParkingViolation:
        cid = self._one_community(community_id)
        _enum("violation_type", payload.violation_type)
        if payload.fine_amount is not None:
            await self._require_staff(cid, "levy a parking fine")
        await ensure_confirmed_async(self.db, payload.evidence_url)
        # Every referenced row must live in this community (no cross-tenant references).
        vehicle: Vehicle | None = None
        if payload.vehicle_id is not None:
            vehicle = await self._vehicle_in(cid, payload.vehicle_id)
        elif payload.registration_number is not None:
            vehicle = await self.vehicles.by_plate(cid, payload.registration_number)
        if payload.parking_slot_id is not None:
            await self._slot_in(cid, payload.parking_slot_id)
        plate = vehicle.registration_number if vehicle else payload.registration_number
        obj = ParkingViolation(
            community_id=cid,
            vehicle_id=vehicle.id if vehicle else None,
            registration_number=plate,
            parking_slot_id=payload.parking_slot_id,
            reported_by_user_id=self.actor.id,
            violation_type=payload.violation_type,
            description=payload.description,
            evidence_url=payload.evidence_url,
            fine_amount=payload.fine_amount,
        )
        await self.violations.add(obj)
        await self._audit(
            "violation.report",
            cid,
            "parking_violation",
            obj.id,
            new={"plate": plate, "type": obj.violation_type, "fine": str(obj.fine_amount or "")},
        )
        if vehicle is not None:
            await notif_events.emit(
                self.db,
                self.scope,
                self.actor,
                self.ctx,
                recipient_user_id=await self.vehicles.owner_user_id(vehicle),
                community_id=cid,
                notification_type="vehicles.violation_reported",
                title="Parking violation reported",
                message=(
                    f"A '{obj.violation_type.replace('_', ' ')}' parking violation was "
                    f"reported for your vehicle {vehicle.registration_number}."
                ),
                reference_type="parking_violation",
                reference_id=obj.id,
            )
        return obj

    async def transition_violation(
        self, violation_id: uuid.UUID, new_status: str
    ) -> ParkingViolation:
        obj = await self.violations.get(violation_id)
        if obj is None:
            raise NotFoundError("Violation not found")
        await self._require_staff(obj.community_id, "change a violation's status")
        _enum("violation_status", new_status)
        if new_status not in _VIOLATION_TRANSITIONS[obj.status]:
            raise BusinessRuleError(
                f"Cannot move a '{obj.status}' violation to '{new_status}'",
                code="INVALID_TRANSITION",
            )
        old_status = obj.status
        obj.status = new_status
        if new_status in ("resolved", "waived"):
            obj.resolved_at = datetime.now(UTC)
        await self.db.flush()
        await self._audit(
            f"violation.{new_status}",
            obj.community_id,
            "parking_violation",
            obj.id,
            old={"status": old_status},
            new={"status": new_status},
        )
        return obj

    async def list_violations(
        self,
        *,
        community_id: uuid.UUID | None,
        violation_status: str | None,
        offset: int,
        limit: int,
        plate: str | None = None,
    ) -> tuple[list[ParkingViolation], int]:
        _enum("violation_status", violation_status)
        stmt = select(ParkingViolation)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(ParkingViolation.community_id == community_id)
        if violation_status:
            stmt = stmt.where(ParkingViolation.status == violation_status)
        if plate:
            stmt = stmt.where(
                ParkingViolation.registration_number.ilike(f"%{plate_search_term(plate)}%")
            )
        # A resident sees violations against their unit's vehicles, plus ones they reported.
        unit_scope = await self._unit_scope(community_id)
        if unit_scope is not None:
            mine = ParkingViolation.reported_by_user_id == self.actor.id
            if unit_scope:
                stmt = stmt.where(
                    ParkingViolation.vehicle_id.in_(self.vehicles.ids_for_units(unit_scope)) | mine
                )
            else:
                stmt = stmt.where(mine)
        stmt = stmt.order_by(ParkingViolation.occurred_at.desc())
        return await self.violations.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.violations.count(extra=stmt)

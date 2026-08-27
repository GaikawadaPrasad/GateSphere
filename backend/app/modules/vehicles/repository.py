"""Data-access for Vehicle & Parking (FR-08). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.vehicles.models import (
    ParkingAllocation,
    ParkingRule,
    ParkingSlot,
    ParkingViolation,
    Vehicle,
    VehicleEntry,
)


class VehicleRepository(TenantRepository[Vehicle]):
    model = Vehicle

    def by_plate(self, community_id: uuid.UUID, plate: str) -> Vehicle | None:
        return self.db.scalar(
            select(Vehicle).where(
                Vehicle.community_id == community_id,
                Vehicle.registration_number == plate,
            )
        )


class SlotRepository(TenantRepository[ParkingSlot]):
    model = ParkingSlot

    def by_code(self, community_id: uuid.UUID, code: str) -> ParkingSlot | None:
        return self.db.scalar(
            select(ParkingSlot).where(
                ParkingSlot.community_id == community_id, ParkingSlot.slot_code == code
            )
        )


class AllocationRepository(TenantRepository[ParkingAllocation]):
    model = ParkingAllocation

    def active_for_slot(self, slot_id: uuid.UUID) -> ParkingAllocation | None:
        return self.db.scalar(
            select(ParkingAllocation).where(
                ParkingAllocation.slot_id == slot_id, ParkingAllocation.status == "active"
            )
        )

    def active_for_vehicle(self, vehicle_id: uuid.UUID) -> ParkingAllocation | None:
        return self.db.scalar(
            select(ParkingAllocation).where(
                ParkingAllocation.vehicle_id == vehicle_id,
                ParkingAllocation.status == "active",
            )
        )

    def active_count_for_unit(self, unit_id: uuid.UUID) -> int:
        return len(
            list(
                self.db.scalars(
                    select(ParkingAllocation).where(
                        ParkingAllocation.unit_id == unit_id,
                        ParkingAllocation.status == "active",
                    )
                ).all()
            )
        )


class EntryRepository(TenantRepository[VehicleEntry]):
    model = VehicleEntry

    def open_for_plate(self, community_id: uuid.UUID, plate: str) -> VehicleEntry | None:
        return self.db.scalar(
            select(VehicleEntry).where(
                VehicleEntry.community_id == community_id,
                VehicleEntry.registration_number == plate,
                VehicleEntry.status == "inside",
            )
        )


class RuleRepository(TenantRepository[ParkingRule]):
    model = ParkingRule

    def for_community(self, community_id: uuid.UUID) -> ParkingRule | None:
        return self.db.scalar(select(ParkingRule).where(ParkingRule.community_id == community_id))


class ViolationRepository(TenantRepository[ParkingViolation]):
    model = ParkingViolation

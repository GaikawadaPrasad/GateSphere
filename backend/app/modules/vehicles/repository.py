"""Data-access for Vehicle & Parking (FR-08). Queries only."""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from datetime import date

from sqlalchemy import Select, func, or_, select

from app.db.repository import AsyncTenantRepository
from app.modules.residents.models import ResidentProfile
from app.modules.vehicles.models import (
    ParkingAllocation,
    ParkingRule,
    ParkingSlot,
    ParkingViolation,
    Vehicle,
    VehicleEntry,
)
from app.modules.visitors.models import Visitor, VisitorBlacklist, VisitorPolicy


class VehicleRepository(AsyncTenantRepository[Vehicle]):
    model = Vehicle

    async def by_plate(self, community_id: uuid.UUID, plate: str) -> Vehicle | None:
        return await self.db.scalar(
            select(Vehicle).where(
                Vehicle.community_id == community_id,
                Vehicle.registration_number == plate,
            )
        )

    @staticmethod
    def ids_for_units(unit_ids: Iterable[uuid.UUID]) -> Select:
        """Sub-select of vehicle ids registered to `unit_ids` (own-unit list scoping)."""
        return select(Vehicle.id).where(Vehicle.unit_id.in_(list(unit_ids)))

    async def owner_user_id(self, vehicle: Vehicle) -> uuid.UUID | None:
        """The login of the resident who owns `vehicle` (None for a visitor vehicle)."""
        if vehicle.resident_profile_id is None:
            return None
        return await self.db.scalar(
            select(ResidentProfile.user_id).where(
                ResidentProfile.id == vehicle.resident_profile_id,
                ResidentProfile.community_id == vehicle.community_id,
            )
        )

    async def plate_blacklist_hit(
        self, community_id: uuid.UUID, plate: str
    ) -> VisitorBlacklist | None:
        """An active blacklist row whose visitor is known to drive `plate` (FR-05)."""
        today = date.today()
        norm = func.upper(func.replace(func.replace(Visitor.vehicle_number, " ", ""), "-", ""))
        return await self.db.scalar(
            select(VisitorBlacklist)
            .join(Visitor, Visitor.id == VisitorBlacklist.visitor_id)
            .where(
                VisitorBlacklist.community_id == community_id,
                Visitor.community_id == community_id,
                VisitorBlacklist.is_active.is_(True),
                VisitorBlacklist.active_from <= today,
                or_(
                    VisitorBlacklist.active_until.is_(None), VisitorBlacklist.active_until >= today
                ),
                norm == plate,
            )
            .limit(1)
        )

    async def blacklist_mode(self, community_id: uuid.UUID) -> str:
        """`visitor_policies.blacklist_mode` (config-as-data); `block` when unset."""
        mode = await self.db.scalar(
            select(VisitorPolicy.blacklist_mode).where(VisitorPolicy.community_id == community_id)
        )
        return mode or "block"


class SlotRepository(AsyncTenantRepository[ParkingSlot]):
    model = ParkingSlot

    async def by_code(self, community_id: uuid.UUID, code: str) -> ParkingSlot | None:
        return await self.db.scalar(
            select(ParkingSlot).where(
                ParkingSlot.community_id == community_id, ParkingSlot.slot_code == code
            )
        )


class AllocationRepository(AsyncTenantRepository[ParkingAllocation]):
    model = ParkingAllocation

    async def active_for_slot(self, slot_id: uuid.UUID) -> ParkingAllocation | None:
        return await self.db.scalar(
            select(ParkingAllocation).where(
                ParkingAllocation.slot_id == slot_id, ParkingAllocation.status == "active"
            )
        )

    async def active_for_vehicle(self, vehicle_id: uuid.UUID) -> ParkingAllocation | None:
        return await self.db.scalar(
            select(ParkingAllocation).where(
                ParkingAllocation.vehicle_id == vehicle_id,
                ParkingAllocation.status == "active",
            )
        )

    async def active_count_for_unit(self, unit_id: uuid.UUID) -> int:
        return (
            await self.db.scalar(
                select(func.count())
                .select_from(ParkingAllocation)
                .where(
                    ParkingAllocation.unit_id == unit_id,
                    ParkingAllocation.status == "active",
                )
            )
        ) or 0


class EntryRepository(AsyncTenantRepository[VehicleEntry]):
    model = VehicleEntry

    async def open_for_plate(self, community_id: uuid.UUID, plate: str) -> VehicleEntry | None:
        return await self.db.scalar(
            select(VehicleEntry).where(
                VehicleEntry.community_id == community_id,
                VehicleEntry.registration_number == plate,
                VehicleEntry.status == "inside",
            )
        )


class RuleRepository(AsyncTenantRepository[ParkingRule]):
    model = ParkingRule

    async def for_community(self, community_id: uuid.UUID) -> ParkingRule | None:
        return await self.db.scalar(
            select(ParkingRule).where(ParkingRule.community_id == community_id)
        )


class ViolationRepository(AsyncTenantRepository[ParkingViolation]):
    model = ParkingViolation

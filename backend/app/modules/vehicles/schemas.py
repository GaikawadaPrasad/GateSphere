"""Pydantic models for Vehicle & Parking (FR-08). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.vehicles.models import (
    ALLOCATION_STATUS,
    ENTRY_SOURCE,
    SLOT_STATUS,
    SLOT_TYPES,
    VEHICLE_TYPES,
    VIOLATION_STATUS,
    VIOLATION_TYPES,
)

ALLOWED = {
    "vehicle_type": set(VEHICLE_TYPES),
    "slot_type": set(SLOT_TYPES),
    "slot_status": set(SLOT_STATUS),
    "allocation_status": set(ALLOCATION_STATUS),
    "source_type": set(ENTRY_SOURCE),
    "violation_type": set(VIOLATION_TYPES),
    "violation_status": set(VIOLATION_STATUS),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- vehicles ------------------------------------------------------- #
class VehicleCreate(_Write):
    vehicle_type: str
    registration_number: str = Field(min_length=3, max_length=20)
    resident_profile_id: uuid.UUID | None = None
    visitor_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    make: str | None = Field(default=None, max_length=60)
    model: str | None = Field(default=None, max_length=60)
    color: str | None = Field(default=None, max_length=30)
    sticker_number: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def _owner_xor(self) -> VehicleCreate:
        if bool(self.resident_profile_id) == bool(self.visitor_id):
            raise ValueError("exactly one of resident_profile_id / visitor_id is required")
        return self


class VehicleUpdate(_Write):
    vehicle_type: str | None = None
    make: str | None = Field(default=None, max_length=60)
    model: str | None = Field(default=None, max_length=60)
    color: str | None = Field(default=None, max_length=30)
    sticker_number: str | None = Field(default=None, max_length=40)
    unit_id: uuid.UUID | None = None
    is_active: bool | None = None


class VehicleRead(_Read):
    community_id: uuid.UUID
    resident_profile_id: uuid.UUID | None
    visitor_id: uuid.UUID | None
    unit_id: uuid.UUID | None
    vehicle_type: str
    registration_number: str
    make: str | None
    model: str | None
    color: str | None
    sticker_number: str | None
    is_active: bool


# -- parking rules ---------------------------------------------- #
class RuleUpdate(_Write):
    allow_multi_slot_vehicle: bool | None = None
    allow_guest_parking: bool | None = None
    max_active_slots_per_unit: int | None = Field(default=None, ge=0, le=20)
    violation_grace_minutes: int | None = Field(default=None, ge=0, le=1440)


class RuleRead(_Read):
    community_id: uuid.UUID
    allow_multi_slot_vehicle: bool
    allow_guest_parking: bool
    max_active_slots_per_unit: int
    violation_grace_minutes: int


# -- parking slots -------------------------------------------- #
class SlotCreate(_Write):
    slot_code: str = Field(min_length=1, max_length=20)
    slot_type: str = "car"
    tower_id: uuid.UUID | None = None
    level: str | None = Field(default=None, max_length=20)
    is_guest_slot: bool = False
    reserved_for_unit_id: uuid.UUID | None = None


class SlotRead(_Read):
    community_id: uuid.UUID
    tower_id: uuid.UUID | None
    slot_code: str
    slot_type: str
    level: str | None
    status: str
    is_guest_slot: bool
    reserved_for_unit_id: uuid.UUID | None


# -- allocations -------------------------------------------- #
class AllocationCreate(_Write):
    slot_id: uuid.UUID
    vehicle_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    allocated_to: datetime | None = None


class AllocationRead(_Read):
    community_id: uuid.UUID
    slot_id: uuid.UUID
    vehicle_id: uuid.UUID
    unit_id: uuid.UUID | None
    allocated_from: datetime
    allocated_to: datetime | None
    status: str


# -- gate entries ------------------------------------------ #
class EntryCreate(_Write):
    registration_number: str = Field(min_length=3, max_length=20)
    gate_id: uuid.UUID | None = None
    source_type: str = "unknown"
    reference_id: uuid.UUID | None = None


class EntryRead(_Read):
    community_id: uuid.UUID
    vehicle_id: uuid.UUID | None
    registration_number: str
    gate_id: uuid.UUID | None
    entry_at: datetime
    exit_at: datetime | None
    source_type: str
    status: str
    is_flagged: bool


# -- violations ------------------------------------------- #
class ViolationCreate(_Write):
    violation_type: str
    vehicle_id: uuid.UUID | None = None
    parking_slot_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=2000)
    evidence_url: str | None = None
    fine_amount: Decimal | None = Field(default=None, ge=0)


class ViolationRead(_Read):
    community_id: uuid.UUID
    vehicle_id: uuid.UUID | None
    parking_slot_id: uuid.UUID | None
    reported_by_user_id: uuid.UUID | None
    violation_type: str
    description: str | None
    occurred_at: datetime
    evidence_url: str | None
    fine_amount: Decimal | None
    status: str
    resolved_at: datetime | None

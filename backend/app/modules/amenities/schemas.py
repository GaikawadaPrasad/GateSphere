"""Pydantic models for Amenity Booking (FR-11). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.amenities.models import AMENITY_TYPES, BOOKING_STATUS, RULE_TYPES

ALLOWED = {
    "amenity_type": set(AMENITY_TYPES),
    "rule_type": set(RULE_TYPES),
    "booking_status": set(BOOKING_STATUS),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- amenities ---------------------------------------------------- #
class AmenityCreate(_Write):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=120)
    amenity_type: str = "other"
    location_text: str | None = Field(default=None, max_length=255)
    capacity: int = Field(default=1, ge=1, le=100000)
    booking_required: bool = True


class AmenityUpdate(_Write):
    name: str | None = Field(default=None, max_length=120)
    amenity_type: str | None = None
    location_text: str | None = Field(default=None, max_length=255)
    capacity: int | None = Field(default=None, ge=1, le=100000)
    booking_required: bool | None = None
    is_active: bool | None = None


class AmenityRead(_Read):
    community_id: uuid.UUID
    code: str
    name: str
    amenity_type: str
    location_text: str | None
    capacity: int
    booking_required: bool
    is_active: bool


# -- slots ------------------------------------------------------ #
class SlotCreate(_Write):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    capacity: int | None = Field(default=None, ge=1, le=100000)
    fee: Decimal = Field(default=Decimal("0"), max_digits=10, decimal_places=2, ge=0)


class SlotRead(_Read):
    community_id: uuid.UUID
    amenity_id: uuid.UUID
    day_of_week: int
    start_time: time
    end_time: time
    capacity: int | None
    fee: Decimal
    is_active: bool


# -- rules ---------------------------------------------------- #
class RuleUpsert(_Write):
    rule_type: str
    rule_value: dict = Field(default_factory=dict)


class RuleRead(_Read):
    community_id: uuid.UUID
    amenity_id: uuid.UUID
    rule_type: str
    rule_value: dict
    is_active: bool


# -- blocks ------------------------------------------------- #
class BlockCreate(_Write):
    blocked_from: datetime
    blocked_to: datetime
    reason: str | None = Field(default=None, max_length=2000)


class BlockRead(_Read):
    community_id: uuid.UUID
    amenity_id: uuid.UUID
    blocked_from: datetime
    blocked_to: datetime
    reason: str | None
    created_by_user_id: uuid.UUID | None


# -- bookings --------------------------------------------- #
class BookingCreate(_Write):
    amenity_id: uuid.UUID
    slot_id: uuid.UUID
    booking_date: date
    participant_count: int = Field(default=1, ge=1, le=100000)


class BookingCancel(_Write):
    reason: str | None = Field(default=None, max_length=2000)


class BookingRead(_Read):
    community_id: uuid.UUID
    amenity_id: uuid.UUID
    slot_id: uuid.UUID | None
    unit_id: uuid.UUID
    resident_user_id: uuid.UUID | None
    booking_date: date
    start_at: datetime
    end_at: datetime
    participant_count: int
    status: str
    amount: Decimal
    cancelled_at: datetime | None
    cancellation_reason: str | None

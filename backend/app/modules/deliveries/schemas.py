"""Pydantic models for Delivery Management (FR-07). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.modules.deliveries.models import (
    APPROVAL_STATUS,
    DELIVERY_STATUS,
    DELIVERY_TYPES,
    PROTOCOL_TYPES,
)

ALLOWED = {
    "delivery_type": set(DELIVERY_TYPES),
    "protocol_type": set(PROTOCOL_TYPES),
    "approval_status": set(APPROVAL_STATUS),
    "status": set(DELIVERY_STATUS),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- protocols ------------------------------------------------------- #
class ProtocolUpsert(_Write):
    delivery_type: str
    protocol_type: str = "collect_at_gate"
    requires_otp: bool = False
    allow_direct_entry: bool = False
    leave_at_gate: bool = True
    allowed_start_time: time | None = None
    allowed_end_time: time | None = None
    is_active: bool = True


class ProtocolRead(_Read):
    community_id: uuid.UUID
    delivery_type: str
    protocol_type: str
    requires_otp: bool
    allow_direct_entry: bool
    leave_at_gate: bool
    allowed_start_time: time | None
    allowed_end_time: time | None
    is_active: bool


# -- deliveries ---------------------------------------------------- #
class DeliveryCreate(_Write):
    unit_id: uuid.UUID
    delivery_type: str
    provider_name: str | None = Field(default=None, max_length=120)
    executive_name: str | None = Field(default=None, max_length=120)
    executive_phone: str | None = Field(default=None, max_length=20)
    tracking_reference: str | None = Field(default=None, max_length=120)
    expected_at: datetime | None = None
    parcel_count: int = Field(default=1, ge=1, le=100)
    notes: str | None = Field(default=None, max_length=2000)


class DeliveryDecision(_Write):
    decision: str  # approved | rejected
    remarks: str | None = Field(default=None, max_length=2000)


class DeliveryArrival(_Write):
    gate_id: uuid.UUID | None = None
    executive_name: str | None = Field(default=None, max_length=120)
    executive_phone: str | None = Field(default=None, max_length=20)


class DeliveryRead(_Read):
    community_id: uuid.UUID
    unit_id: uuid.UUID
    resident_user_id: uuid.UUID | None
    protocol_id: uuid.UUID | None
    delivery_type: str
    provider_name: str | None
    executive_name: str | None
    executive_phone: str | None
    tracking_reference: str | None
    approval_status: str
    approved_by_user_id: uuid.UUID | None
    expected_at: datetime | None
    arrived_at: datetime | None
    status: str
    parcel_count: int
    notes: str | None


class EventRead(_Read):
    delivery_id: uuid.UUID
    gate_id: uuid.UUID | None
    actor_user_id: uuid.UUID | None
    event_type: str
    occurred_at: datetime
    remarks: str | None

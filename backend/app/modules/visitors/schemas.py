"""Pydantic models for Visitor Management (FR-04). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.files import ManagedFileUrl
from app.modules.visitors.models import (
    DECISIONS,
    PASS_TYPES,
    REQUEST_STATUS,
    RISK_LEVELS,
    VISITOR_TYPES,
)

ALLOWED = {
    "visitor_type": set(VISITOR_TYPES) | {"guest"},
    "status": set(REQUEST_STATUS),
    "risk_level": set(RISK_LEVELS),
    "pass_type": set(PASS_TYPES),
    "decision": set(DECISIONS),
}
_Phone = Field(min_length=5, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class VisitorCreate(_Write):
    full_name: str = Field(min_length=1, max_length=180)
    phone: str = _Phone
    id_type: str | None = Field(default=None, max_length=30)
    id_number: str | None = Field(default=None, max_length=40)
    vehicle_number: str | None = Field(default=None, max_length=20)
    photo_url: ManagedFileUrl | None = None


class VisitorRead(_Read):
    community_id: uuid.UUID
    full_name: str
    phone: str
    photo_url: str | None
    id_type: str | None
    vehicle_number: str | None
    frequent_visitor_flag: bool
    visit_count: int
    last_visit_at: datetime | None


class BlacklistCreate(_Write):
    phone: str = _Phone
    id_number: str | None = Field(default=None, max_length=40)
    visitor_id: uuid.UUID | None = None
    reason: str = Field(min_length=1, max_length=2000)
    risk_level: str = "medium"
    active_until: datetime | None = None


class BlacklistRead(_Read):
    community_id: uuid.UUID
    visitor_id: uuid.UUID | None
    reason: str
    risk_level: str
    is_active: bool


class RequestCreate(_Write):
    unit_id: uuid.UUID
    visitor: VisitorCreate | None = None
    visitor_id: uuid.UUID | None = None
    visitor_type: str
    purpose: str | None = Field(default=None, max_length=255)
    expected_at: datetime | None = None
    valid_until: datetime | None = None
    vehicle_number: str | None = Field(default=None, max_length=20)
    group_label: str | None = Field(default=None, max_length=120)
    party_size: int = Field(default=1, ge=1, le=50)
    # FR-04 multi-visitor grouping — extra known visitors covered by this one approval
    additional_visitor_ids: list[uuid.UUID] | None = None


class GroupMemberCreate(_Write):
    visitor_id: uuid.UUID | None = None
    visitor: VisitorCreate | None = None


class GroupMemberRead(_Read):
    request_id: uuid.UUID
    visitor_id: uuid.UUID
    is_primary: bool
    added_at: datetime


class PassCreate(_Write):
    pass_type: str = "qr"  # noqa: S105 - not a secret
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    max_entries: int = Field(default=1, ge=1, le=50)
    with_pin: bool = False  # also issue a 6-digit gate PIN (implied for pin/otp pass types)


class PassRead(_Read):
    request_id: uuid.UUID
    pass_type: str
    valid_from: datetime
    valid_to: datetime
    max_entries: int
    entry_count: int
    is_revoked: bool
    token: str | None = None  # returned once, at creation
    pin: str | None = None  # returned once, at creation (when with_pin / pin / otp)


class RequestDecision(_Write):
    decision: str
    remarks: str | None = Field(default=None, max_length=2000)


class RequestRead(_Read):
    community_id: uuid.UUID
    visitor_id: uuid.UUID
    unit_id: uuid.UUID
    host_user_id: uuid.UUID | None
    visitor_type: str
    purpose: str | None
    expected_at: datetime | None
    valid_until: datetime | None
    status: str
    approval_required: bool
    vehicle_number: str | None
    group_label: str | None
    party_size: int
    visitor: VisitorRead | None = None
    visitor_name: str | None = None
    phone: str | None = None
    passes: list[PassRead] = []

    @model_validator(mode="before")
    @classmethod
    def populate_visitor_fields(cls, data: Any) -> Any:
        if hasattr(data, "visitor") and getattr(data, "visitor", None) is not None:
            v = data.visitor
            if getattr(data, "visitor_name", None) is None:
                try:
                    data.visitor_name = getattr(v, "full_name", None)
                except Exception:
                    pass
            if getattr(data, "phone", None) is None:
                try:
                    data.phone = getattr(v, "phone", None)
                except Exception:
                    pass
        elif isinstance(data, dict):
            v = data.get("visitor")
            if isinstance(v, dict):
                data.setdefault("visitor_name", v.get("full_name"))
                data.setdefault("phone", v.get("phone"))
        return data


class EntryCreate(_Write):
    request_id: uuid.UUID | None = None
    pass_token: str | None = None
    pin: str | None = Field(default=None, min_length=4, max_length=12)
    visitor_id: uuid.UUID | None = None
    gate_id: uuid.UUID | None = None
    vehicle_number: str | None = Field(default=None, max_length=20)
    entry_photo_url: ManagedFileUrl | None = None


class EntryRead(_Read):
    community_id: uuid.UUID
    request_id: uuid.UUID | None
    visitor_id: uuid.UUID
    gate_id: uuid.UUID | None
    entry_at: datetime | None
    exit_at: datetime | None
    vehicle_number: str | None
    status: str
    denial_reason: str | None


class PolicyUpdate(_Write):
    approval_required: bool | None = None
    photo_required: bool | None = None
    otp_required: bool | None = None
    pass_ttl_minutes: int | None = Field(default=None, ge=5, le=10080)
    blacklist_mode: str | None = Field(default=None, pattern="^(block|warn)$")


class PolicyRead(_Read):
    community_id: uuid.UUID
    approval_required: bool
    photo_required: bool
    otp_required: bool
    pass_ttl_minutes: int
    blacklist_mode: str

"""Pydantic models for Gate / Security Operations (FR-05). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.modules.gate.models import (
    ALERT_SEVERITY,
    ALERT_STATUS,
    ALERT_TYPES,
    ASSIGNMENT_STATUS,
    EVENT_TYPES,
    ROSTER_STATUS,
)

ALLOWED = {
    "event_type": set(EVENT_TYPES),
    "roster_status": set(ROSTER_STATUS),
    "assignment_status": set(ASSIGNMENT_STATUS),
    "alert_type": set(ALERT_TYPES),
    "severity": set(ALERT_SEVERITY),
    "alert_status": set(ALERT_STATUS),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- gate events ------------------------------------------------------- #
class EventCreate(_Write):
    gate_id: uuid.UUID | None = None
    event_type: str
    reference_type: str | None = Field(default=None, max_length=40)
    reference_id: uuid.UUID | None = None
    occurred_at: datetime | None = None
    metadata: dict | None = None


class EventRead(_Read):
    community_id: uuid.UUID
    gate_id: uuid.UUID | None
    actor_user_id: uuid.UUID | None
    event_type: str
    reference_type: str | None
    reference_id: uuid.UUID | None
    occurred_at: datetime
    metadata: dict | None = Field(default=None, validation_alias="event_metadata")


# -- guard rosters --------------------------------------------------- #
class RosterCreate(_Write):
    guard_user_id: uuid.UUID
    supervisor_user_id: uuid.UUID | None = None
    shift_date: date
    shift_start: time
    shift_end: time
    notes: str | None = Field(default=None, max_length=2000)


class RosterUpdate(_Write):
    status: str | None = None
    supervisor_user_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)


class RosterRead(_Read):
    community_id: uuid.UUID
    guard_user_id: uuid.UUID
    supervisor_user_id: uuid.UUID | None
    shift_date: date
    shift_start: time
    shift_end: time
    status: str
    notes: str | None


# -- gate assignments ---------------------------------------------- #
class AssignmentCreate(_Write):
    guard_user_id: uuid.UUID
    gate_id: uuid.UUID
    roster_id: uuid.UUID | None = None
    assigned_from: datetime | None = None
    assigned_to: datetime | None = None


class AssignmentRead(_Read):
    community_id: uuid.UUID
    guard_user_id: uuid.UUID
    gate_id: uuid.UUID
    roster_id: uuid.UUID | None
    assigned_from: datetime
    assigned_to: datetime | None
    status: str


# -- panic alerts ------------------------------------------------ #
class AlertCreate(_Write):
    alert_type: str = "other"
    severity: str = "high"
    gate_id: uuid.UUID | None = None
    message: str | None = Field(default=None, max_length=2000)
    community_id: uuid.UUID | None = None  # required only for a global caller


class AlertResolve(_Write):
    resolution_summary: str | None = Field(default=None, max_length=2000)


class AlertRead(_Read):
    community_id: uuid.UUID
    triggered_by_user_id: uuid.UUID | None
    gate_id: uuid.UUID | None
    alert_type: str
    severity: str
    message: str | None
    status: str
    triggered_at: datetime
    acknowledged_by_user_id: uuid.UUID | None
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    resolution_summary: str | None

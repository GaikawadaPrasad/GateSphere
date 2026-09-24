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
    created_at: datetime | None = None
    updated_at: datetime | None = None


# -- gate events ------------------------------------------------------- #
class EventCreate(_Write):
    gate_id: uuid.UUID | None = None
    event_type: str
    reference_type: str | None = Field(default=None, max_length=40)
    reference_id: uuid.UUID | None = None
    occurred_at: datetime | None = None
    metadata: dict | None = None


class CheckpointOverride(_Write):
    """Security Supervisor manually overrides a gate checkpoint (FR-05).

    Records an append-only `checkpoint_override` gate event with the mandatory reason;
    notifies supervisors + community admin.
    """

    gate_id: uuid.UUID | None = None
    reason: str = Field(min_length=3, max_length=500)
    reference_type: str | None = Field(default=None, max_length=40)
    reference_id: uuid.UUID | None = None
    community_id: uuid.UUID | None = None  # required only for a global caller w/o gate_id


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
    supervisor_user_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)


class RosterTransition(_Write):
    status: str  # planned -> active -> completed, or -> cancelled
    reason: str | None = Field(default=None, max_length=2000)


class RosterRead(_Read):
    community_id: uuid.UUID
    guard_user_id: uuid.UUID
    supervisor_user_id: uuid.UUID | None
    shift_date: date
    shift_start: time
    shift_end: time
    status: str
    notes: str | None
    guard_name: str | None = None
    guard_phone: str | None = None


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
    triggered_by_user_id: uuid.UUID | None = None
    gate_id: uuid.UUID | None = None
    alert_type: str = "other"
    severity: str = "high"
    message: str | None = None
    status: str = "active"
    triggered_at: datetime | None = None
    acknowledged_by_user_id: uuid.UUID | None = None
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    resolution_summary: str | None = None
    # Reporter identity + location (GS-SOS-001/002/026), resolved via repository.enrich_alerts
    # from `triggered_by_user_id`'s active unit occupancy — never persisted on the row itself.
    reporter_name: str | None = None
    reporter_phone: str | None = None
    tower_name: str | None = None
    floor_number: int | None = None
    unit_number: str | None = None

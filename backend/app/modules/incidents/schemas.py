"""Pydantic models for Emergency & Incident Management (FR-13). `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.incidents.models import (
    ACTION_TYPES,
    INCIDENT_STATUS,
    INCIDENT_TYPES,
    SEVERITIES,
)

ALLOWED = {
    "incident_type": set(INCIDENT_TYPES),
    "severity": set(SEVERITIES),
    "status": set(INCIDENT_STATUS),
    "action_type": set(ACTION_TYPES),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class IncidentCreate(_Write):
    incident_type: str
    severity: str = "medium"
    tower_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    gate_id: uuid.UUID | None = None
    panic_alert_id: uuid.UUID | None = None
    location_text: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=8000)
    community_id: uuid.UUID | None = None


class IncidentUpdate(_Write):
    severity: str | None = None
    location_text: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=8000)


class IncidentTransition(_Write):
    status: str
    reason: str | None = Field(default=None, max_length=2000)
    resolution_summary: str | None = Field(default=None, max_length=4000)


class AssignIn(_Write):
    assigned_user_id: uuid.UUID


class ActionIn(_Write):
    action_type: str
    details: str | None = Field(default=None, max_length=4000)


class HistoryRead(_Read):
    incident_id: uuid.UUID
    old_status: str | None
    new_status: str
    changed_by_user_id: uuid.UUID | None
    reason: str | None
    changed_at: datetime


class AssignmentRead(_Read):
    incident_id: uuid.UUID
    assigned_user_id: uuid.UUID
    assigned_by_user_id: uuid.UUID | None
    assigned_at: datetime
    released_at: datetime | None
    is_active: bool


class ActionRead(_Read):
    incident_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    action_type: str
    details: str | None
    action_at: datetime


class IncidentRead(_Read):
    community_id: uuid.UUID
    incident_number: str
    incident_type: str
    severity: str
    status: str
    tower_id: uuid.UUID | None
    unit_id: uuid.UUID | None
    gate_id: uuid.UUID | None
    location_text: str | None
    reporter_user_id: uuid.UUID | None
    panic_alert_id: uuid.UUID | None
    description: str | None
    reported_at: datetime
    resolved_at: datetime | None
    resolution_summary: str | None

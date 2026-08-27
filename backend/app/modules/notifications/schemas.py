"""Pydantic models for Notifications (FR-15). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.modules.notifications.models import CHANNELS, DELIVERY_STATUS

ALLOWED = {"channel": set(CHANNELS), "delivery_status": set(DELIVERY_STATUS)}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- templates -------------------------------------------------- #
class TemplateUpsert(_Write):
    code: str = Field(min_length=1, max_length=60)
    channel: str = "in_app"
    title_template: str = Field(min_length=1, max_length=300)
    body_template: str = Field(min_length=1, max_length=8000)
    is_active: bool = True


class TemplateRead(_Read):
    community_id: uuid.UUID
    code: str
    channel: str
    title_template: str
    body_template: str
    is_active: bool


# -- preferences ---------------------------------------------- #
class PreferenceUpsert(_Write):
    channel: str
    is_enabled: bool = True
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    community_id: uuid.UUID | None = None


class PreferenceRead(_Read):
    user_id: uuid.UUID
    community_id: uuid.UUID | None
    channel: str
    is_enabled: bool
    quiet_hours_start: time | None
    quiet_hours_end: time | None


# -- dispatch / notifications ------------------------------- #
class DispatchIn(_Write):
    recipient_user_id: uuid.UUID
    notification_type: str = Field(min_length=1, max_length=60)
    template_code: str | None = None
    title: str | None = Field(default=None, max_length=300)
    message: str | None = Field(default=None, max_length=8000)
    reference_type: str | None = Field(default=None, max_length=40)
    reference_id: uuid.UUID | None = None
    context: dict[str, str] = Field(default_factory=dict)
    channels: list[str] | None = None
    community_id: uuid.UUID | None = None


class DeliveryRead(_Read):
    notification_id: uuid.UUID
    channel: str
    provider: str
    status: str
    provider_message_id: str | None
    sent_at: datetime | None
    delivered_at: datetime | None
    failure_reason: str | None
    attempt_count: int


class NotificationRead(_Read):
    community_id: uuid.UUID
    recipient_user_id: uuid.UUID
    template_id: uuid.UUID | None
    notification_type: str
    title: str
    message: str
    reference_type: str | None
    reference_id: uuid.UUID | None
    is_read: bool
    read_at: datetime | None
    deliveries: list[DeliveryRead] = []

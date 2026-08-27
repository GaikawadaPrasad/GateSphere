"""Pydantic models for Complaint & Service Desk (FR-10). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.complaints.models import CONFIRMATION_STATUS, PRIORITIES, TICKET_STATUS

ALLOWED = {
    "priority": set(PRIORITIES),
    "status": set(TICKET_STATUS),
    "confirmation_status": set(CONFIRMATION_STATUS),
}


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- categories --------------------------------------------------- #
class CategoryCreate(_Write):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=120)
    default_priority: str = "medium"


class CategoryUpdate(_Write):
    name: str | None = Field(default=None, max_length=120)
    default_priority: str | None = None
    is_active: bool | None = None


class CategoryRead(_Read):
    community_id: uuid.UUID
    code: str
    name: str
    default_priority: str
    is_active: bool


# -- SLA policies ---------------------------------------------- #
class SlaCreate(_Write):
    category_id: uuid.UUID
    priority: str
    response_minutes: int = Field(default=120, ge=1, le=100000)
    resolution_minutes: int = Field(default=1440, ge=1, le=1000000)
    escalation_minutes: int = Field(default=2880, ge=1, le=1000000)


class SlaRead(_Read):
    community_id: uuid.UUID
    category_id: uuid.UUID
    priority: str
    response_minutes: int
    resolution_minutes: int
    escalation_minutes: int
    is_active: bool


# -- tickets ------------------------------------------------- #
class TicketCreate(_Write):
    unit_id: uuid.UUID
    category_id: uuid.UUID
    subject: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=8000)
    priority: str | None = None  # defaults to the category's priority


class TicketAssign(_Write):
    assigned_to_user_id: uuid.UUID | None = None
    vendor_name: str | None = Field(default=None, max_length=160)
    remarks: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _executor_xor(self) -> TicketAssign:
        if bool(self.assigned_to_user_id) == bool(self.vendor_name):
            raise ValueError("exactly one of assigned_to_user_id / vendor_name is required")
        return self


class TicketTransition(_Write):
    status: str
    remarks: str | None = Field(default=None, max_length=2000)


class TicketConfirm(_Write):
    confirmation_status: str  # confirmed | disputed
    remarks: str | None = Field(default=None, max_length=2000)


class MessageCreate(_Write):
    message: str = Field(min_length=1, max_length=8000)
    is_internal: bool = False


class FeedbackCreate(_Write):
    rating: int = Field(ge=1, le=5)
    comments: str | None = Field(default=None, max_length=2000)


class MessageRead(_Read):
    ticket_id: uuid.UUID
    sender_user_id: uuid.UUID | None
    message: str
    is_internal: bool


class HistoryRead(_Read):
    ticket_id: uuid.UUID
    from_status: str | None
    to_status: str
    changed_by_user_id: uuid.UUID | None
    remarks: str | None
    changed_at: datetime


class AssignmentRead(_Read):
    ticket_id: uuid.UUID
    assigned_to_user_id: uuid.UUID | None
    vendor_name: str | None
    assigned_by_user_id: uuid.UUID | None
    assigned_at: datetime
    unassigned_at: datetime | None
    is_active: bool


class FeedbackRead(_Read):
    ticket_id: uuid.UUID
    resident_user_id: uuid.UUID | None
    rating: int
    comments: str | None


class AttachmentIn(_Write):
    file_url: str = Field(min_length=1, max_length=8000)
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = Field(default=None, max_length=120)
    file_size_bytes: int | None = Field(default=None, ge=0)
    message_id: uuid.UUID | None = None


class AttachmentRead(_Read):
    ticket_id: uuid.UUID
    message_id: uuid.UUID | None
    uploaded_by_user_id: uuid.UUID | None
    file_url: str
    file_name: str
    mime_type: str | None
    file_size_bytes: int | None


class TicketRead(_Read):
    community_id: uuid.UUID
    unit_id: uuid.UUID
    ticket_number: str
    raised_by_user_id: uuid.UUID | None
    category_id: uuid.UUID
    sla_policy_id: uuid.UUID | None
    subject: str
    description: str | None
    priority: str
    status: str
    resident_confirmation_status: str
    first_response_due_at: datetime | None
    resolution_due_at: datetime | None
    escalation_due_at: datetime | None
    first_responded_at: datetime | None
    sla_breached_at: datetime | None
    resolved_at: datetime | None
    closed_at: datetime | None

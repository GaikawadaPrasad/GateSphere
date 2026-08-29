"""Pydantic models for tenant onboarding. Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

_OCCUPANCY_ROLES = ("primary_owner", "secondary_owner", "tenant", "family", "occupant")


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


_Phone = Field(default=None, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")


# --- invitations --------------------------------------------------------- #
class InvitationCreate(_Write):
    unit_id: uuid.UUID
    invited_email: EmailStr
    invited_phone: str | None = _Phone
    full_name: str | None = Field(default=None, max_length=255)
    role_slug: str = "resident"
    occupancy_role: str = "tenant"
    is_primary: bool = False
    agreement_reference: str | None = Field(default=None, max_length=120)
    message: str | None = Field(default=None, max_length=2000)
    expires_in_days: int = Field(default=14, ge=1, le=90)


class InvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    community_id: uuid.UUID
    unit_id: uuid.UUID
    invited_email: str
    invited_phone: str | None
    full_name: str | None
    role_slug: str
    occupancy_role: str
    is_primary: bool
    agreement_reference: str | None
    message: str | None
    status: str
    invited_by_user_id: uuid.UUID | None
    expires_at: datetime
    accepted_at: datetime | None
    accepted_user_id: uuid.UUID | None
    resident_profile_id: uuid.UUID | None


class InvitationCreated(InvitationRead):
    token: str  # returned once, at creation
    accept_url: str


class InvitationPublic(BaseModel):
    """What an un-authenticated invitee sees before accepting."""

    community_id: uuid.UUID
    community_name: str
    unit_label: str
    invited_email: str
    invited_name: str | None
    occupancy_role: str
    is_primary: bool
    invited_by: str | None
    status: str
    expires_at: datetime
    account_exists: bool  # frontend: prompt login vs set-password


class EmergencyContactIn(_Write):
    name: str = Field(min_length=1, max_length=180)
    relationship_type: str = Field(min_length=1, max_length=40, alias="relationship")
    phone: str = Field(min_length=5, max_length=20)
    alternate_phone: str | None = Field(default=None, max_length=20)
    priority: int = Field(default=1, ge=1, le=9)

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class InvitationAccept(_Write):
    # required only when the invited email has no account yet
    password: str | None = Field(default=None, min_length=10, max_length=200)
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = _Phone
    date_of_birth: date | None = None
    id_type: str | None = Field(default=None, max_length=30)
    id_number: str | None = Field(default=None, max_length=40)
    move_in_date: date | None = None
    emergency_contacts: list[EmergencyContactIn] = Field(default_factory=list, max_length=5)


# --- direct tenant management ------------------------------------------ #
class TenantAdd(_Write):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = _Phone
    password: str | None = Field(default=None, min_length=10, max_length=200)
    unit_id: uuid.UUID
    occupancy_role: str = "tenant"
    is_primary: bool = False
    agreement_reference: str | None = Field(default=None, max_length=120)
    move_in_date: date | None = None
    role_slug: str = "resident"


class OccupancyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    unit_id: uuid.UUID
    resident_profile_id: uuid.UUID
    occupancy_role: str
    is_primary: bool
    is_active: bool
    start_date: date
    end_date: date | None


class TenantOut(BaseModel):
    resident_profile_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    full_name: str
    community_id: uuid.UUID
    profile_status: str
    occupancies: list[OccupancyOut] = []
    account_created: bool = False
    logged_in: bool = False

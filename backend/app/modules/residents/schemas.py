"""Pydantic models for Residents (FR-03). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.residents.models import (
    KYC_STATUS,
    MOVE_STATUS,
    MOVE_TYPES,
    OCCUPANCY_ROLES,
    PROFILE_STATUS,
    RELATIONSHIPS,
)

ALLOWED = {
    "profile_status": set(PROFILE_STATUS),
    "kyc_status": set(KYC_STATUS),
    "occupancy_role": set(OCCUPANCY_ROLES),
    "relationship_type": set(RELATIONSHIPS),
    "move_type": set(MOVE_TYPES),
    "move_status": set(MOVE_STATUS),
}

_Phone = Field(default=None, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    community_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- ResidentProfile ---------------------------------------------------- #
class ResidentProfileCreate(_Write):
    user_id: uuid.UUID
    profile_status: str = "pending"
    kyc_status: str = "not_started"
    move_in_date: date | None = None
    emergency_notes: str | None = Field(default=None, max_length=2000)


class ResidentProfileUpdate(_Write):
    profile_status: str | None = None
    kyc_status: str | None = None
    move_in_date: date | None = None
    move_out_date: date | None = None
    emergency_notes: str | None = Field(default=None, max_length=2000)


class ResidentProfileRead(_Read):
    user_id: uuid.UUID
    profile_status: str
    kyc_status: str
    move_in_date: date | None
    move_out_date: date | None
    emergency_notes: str | None


# --- UnitOccupancy ---------------------------------------------------- #
class OccupancyCreate(_Write):
    unit_id: uuid.UUID
    resident_profile_id: uuid.UUID
    occupancy_role: str
    is_primary: bool = False
    start_date: date | None = None
    agreement_reference: str | None = Field(default=None, max_length=120)


class OccupancyEnd(_Write):
    end_date: date
    is_active: bool = False


class OccupancyRead(_Read):
    unit_id: uuid.UUID
    resident_profile_id: uuid.UUID
    occupancy_role: str
    is_primary: bool
    start_date: date
    end_date: date | None
    agreement_reference: str | None
    is_active: bool


# --- FamilyMember --------------------------------------------------- #
class FamilyMemberCreate(_Write):
    unit_id: uuid.UUID
    primary_resident_profile_id: uuid.UUID
    full_name: str = Field(min_length=1, max_length=180)
    relationship_type: str = Field(alias="relationship")
    user_id: uuid.UUID | None = None
    date_of_birth: date | None = None
    phone: str | None = _Phone

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, populate_by_name=True)


class FamilyMemberRead(_Read):
    unit_id: uuid.UUID
    primary_resident_profile_id: uuid.UUID
    user_id: uuid.UUID | None
    full_name: str
    relationship_type: str = Field(serialization_alias="relationship")
    date_of_birth: date | None
    phone: str | None
    access_enabled: bool

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- EmergencyContact --------------------------------------------- #
class EmergencyContactCreate(_Write):
    name: str = Field(min_length=1, max_length=180)
    relationship_type: str = Field(alias="relationship", max_length=40)
    phone: str = Field(min_length=5, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")
    alternate_phone: str | None = _Phone
    priority: int = Field(default=1, ge=1, le=10)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, populate_by_name=True)


class EmergencyContactRead(_Read):
    resident_profile_id: uuid.UUID
    name: str
    relationship_type: str = Field(serialization_alias="relationship")
    phone: str
    alternate_phone: str | None
    priority: int

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# --- MoveRecord ------------------------------------------------- #
class MoveRecordCreate(_Write):
    unit_id: uuid.UUID
    resident_profile_id: uuid.UUID
    move_type: str
    scheduled_at: datetime | None = None
    clearance_notes: str | None = Field(default=None, max_length=2000)


class MoveRecordTransition(_Write):
    status: str
    scheduled_at: datetime | None = None
    clearance_notes: str | None = Field(default=None, max_length=2000)


class MoveRecordRead(_Read):
    unit_id: uuid.UUID
    resident_profile_id: uuid.UUID
    move_type: str
    status: str
    requested_at: datetime
    scheduled_at: datetime | None
    clearance_notes: str | None
    approved_by_user_id: uuid.UUID | None
    approved_at: datetime | None

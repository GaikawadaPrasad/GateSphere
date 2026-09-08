"""Pydantic models for Domestic Staff (FR-06). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

from app.core.files import ManagedFileUrl
from app.modules.domestic_staff.models import (
    ATTENDANCE_STATUS,
    STAFF_TYPES,
    VERIFICATION_STATUS,
    WORK_TYPES,
)

ALLOWED = {
    "staff_type": set(STAFF_TYPES),
    "police_verification_status": set(VERIFICATION_STATUS),
    "work_type": set(WORK_TYPES),
    "attendance_status": set(ATTENDANCE_STATUS),
}
_Phone = Field(min_length=5, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- staff ----------------------------------------------------------- #
class StaffCreate(_Write):
    full_name: str = Field(min_length=1, max_length=180)
    staff_type: str
    phone: str = _Phone
    user_id: uuid.UUID | None = None
    id_type: str | None = Field(default=None, max_length=30)
    id_number: str | None = Field(default=None, max_length=40)
    photo_url: ManagedFileUrl | None = None
    police_verification_status: str = "not_started"
    verification_expiry: date | None = None
    emergency_address: str | None = Field(default=None, max_length=2000)


class StaffUpdate(_Write):
    full_name: str | None = Field(default=None, max_length=180)
    staff_type: str | None = None
    photo_url: ManagedFileUrl | None = None
    police_verification_status: str | None = None
    verification_expiry: date | None = None
    emergency_address: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class StaffRead(_Read):
    community_id: uuid.UUID
    user_id: uuid.UUID | None
    full_name: str
    staff_type: str
    phone: str
    photo_url: str | None
    id_type: str | None
    police_verification_status: str
    verification_expiry: date | None
    emergency_address: str | None
    is_active: bool


# -- unit assignments -------------------------------------------- #
class AssignmentCreate(_Write):
    staff_id: uuid.UUID
    unit_id: uuid.UUID
    work_type: str = "part_time"
    start_date: date | None = None
    end_date: date | None = None
    time_from: time | None = None
    time_to: time | None = None


class AssignmentRead(_Read):
    community_id: uuid.UUID
    staff_id: uuid.UUID
    unit_id: uuid.UUID
    approved_by_user_id: uuid.UUID | None
    work_type: str
    start_date: date | None
    end_date: date | None
    time_from: time | None
    time_to: time | None
    is_active: bool


# -- attendance ------------------------------------------------ #
class CheckInCreate(_Write):
    staff_id: uuid.UUID
    gate_id: uuid.UUID | None = None


class AttendanceRead(_Read):
    community_id: uuid.UUID
    staff_id: uuid.UUID
    gate_id: uuid.UUID | None
    check_in_at: datetime
    check_out_at: datetime | None
    attendance_status: str


# -- ratings ------------------------------------------------- #
class RatingCreate(_Write):
    staff_id: uuid.UUID
    unit_id: uuid.UUID | None = None
    rating: int = Field(ge=1, le=5)
    feedback: str | None = Field(default=None, max_length=2000)


class RatingRead(_Read):
    community_id: uuid.UUID
    staff_id: uuid.UUID
    unit_id: uuid.UUID | None
    resident_user_id: uuid.UUID | None
    rating: int
    feedback: str | None


# -- staff me / portal --------------------------------------- #
class StaffMeUpdate(_Write):
    phone: str | None = _Phone
    emergency_address: str | None = Field(default=None, max_length=2000)
    photo_url: ManagedFileUrl | None = None


class StaffMeRead(_Read):
    community_id: uuid.UUID
    user_id: uuid.UUID | None
    full_name: str
    staff_type: str
    phone: str
    photo_url: str | None
    id_type: str | None
    police_verification_status: str
    verification_expiry: date | None
    emergency_address: str | None
    is_active: bool
    rating_avg: float = 5.0
    ratings_count: int = 0
    current_status: str = "outside"
    active_assignment_count: int = 0


class AssignmentDetailRead(_Read):
    community_id: uuid.UUID
    staff_id: uuid.UUID
    unit_id: uuid.UUID
    unit_number: str | None = None
    tower_name: str | None = None
    floor_number: int | None = None
    resident_name: str | None = None
    resident_phone: str | None = None
    work_type: str
    start_date: date | None = None
    end_date: date | None = None
    time_from: time | None = None
    time_to: time | None = None
    is_active: bool


class StaffVisitRead(BaseModel):
    id: uuid.UUID
    unit_id: uuid.UUID | None = None
    unit_number: str | None = None
    date: dt.date | None = None
    check_in_at: dt.datetime | None = None
    check_out_at: dt.datetime | None = None
    duration_minutes: int | None = None
    tasks_performed: str | None = None
    rating: int | None = None
    feedback: str | None = None

"""Pydantic models for Domestic Staff (FR-06). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import datetime as dt
import re
import uuid
from datetime import date, datetime, time
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.constants import PASSWORD_MIN_LENGTH
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


def _validate_id_doc(id_type: str | None, id_number: str | None) -> None:
    if not id_number:
        return
    raw_id = id_number.strip()
    id_type_norm = (id_type or "").strip().lower()

    if id_type_norm in ("aadhaar", "aadhar"):
        clean_aadhaar = re.sub(r"[\s-]", "", raw_id)
        if not re.match(r"^\d{12}$", clean_aadhaar):
            raise ValueError(
                "Aadhaar number must be exactly 12 numeric digits (e.g. 1234 5678 9012)"
            )
        if re.match(r"^(\d)\1{11}$", clean_aadhaar):
            raise ValueError("Aadhaar number cannot contain all identical repeating digits")
    elif id_type_norm in ("pan", "pan card", "pan_card"):
        clean_pan = re.sub(r"[\s-]", "", raw_id).upper()
        if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", clean_pan):
            raise ValueError("PAN Card must be 10 characters in format ABCDE1234F")
    elif id_type_norm in ("voter id", "voter_id", "voterid"):
        clean_voter = re.sub(r"[\s-]", "", raw_id).upper()
        if not re.match(r"^[A-Z]{3}[0-9]{7}$", clean_voter):
            raise ValueError("Voter ID must be 10 characters in format ABC1234567")
    elif id_type_norm in ("passport",):
        clean_passport = re.sub(r"[\s-]", "", raw_id).upper()
        if not re.match(r"^[A-Z][0-9]{7,8}$", clean_passport):
            raise ValueError(
                "Passport number must be 1 letter followed by 7-8 digits (e.g. A1234567)"
            )
    elif id_type_norm in ("driving license", "driving_license", "dl"):
        clean_dl = re.sub(r"[\s-]", "", raw_id).upper()
        if not re.match(r"^[A-Z]{2}[0-9A-Z]{8,18}$", clean_dl):
            raise ValueError("Driving License must be valid format (e.g. DL-1420110012345)")


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
    email: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=PASSWORD_MIN_LENGTH, max_length=128)
    user_id: uuid.UUID | None = None
    id_type: str | None = Field(default=None, max_length=30)
    id_number: str | None = Field(default=None, max_length=40)
    photo_url: ManagedFileUrl | None = None
    police_verification_status: str = "not_started"
    verification_expiry: date | None = None
    emergency_address: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def validate_id_document(self) -> Self:
        _validate_id_doc(self.id_type, self.id_number)
        return self


class StaffUpdate(_Write):
    full_name: str | None = Field(default=None, max_length=180)
    staff_type: str | None = None
    id_type: str | None = Field(default=None, max_length=30)
    id_number: str | None = Field(default=None, max_length=40)
    photo_url: ManagedFileUrl | None = None
    police_verification_status: str | None = None
    verification_expiry: date | None = None
    emergency_address: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_id_document(self) -> Self:
        _validate_id_doc(self.id_type, self.id_number)
        return self


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
    days_of_week: list[str] | None = None


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
    days_of_week: list[str] | None = None
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
    is_overdue: bool = False
    duration_hours: float | None = None


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
    full_name: str | None = Field(default=None, min_length=2, max_length=180)
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
    hours_worked_today: float = 0.0
    hours_worked_this_week: float = 0.0
    hours_worked_this_month: float = 0.0


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
    days_of_week: list[str] | None = None
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


# -- digital gate pass & verification ----------------------- #
class StaffPassRead(BaseModel):
    staff_id: uuid.UUID
    full_name: str
    staff_type: str
    phone: str
    photo_url: str | None = None
    pass_code: str
    community_name: str
    police_verification_status: str
    active_assignments: list[AssignmentDetailRead] = []
    generated_at: datetime
    expires_at: datetime


class StaffPassVerifyIn(_Write):
    pass_code: str
    gate_id: uuid.UUID | None = None
    action: str = Field(default="check_in", pattern=r"^(check_in|check_out)$")


class StaffPassVerifyOut(BaseModel):
    success: bool
    action: str
    staff: StaffRead
    attendance: AttendanceRead
    message: str

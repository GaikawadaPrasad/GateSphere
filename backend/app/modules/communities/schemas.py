"""Pydantic request/response models for Community & Property (FR-03).

Write bodies are `extra="forbid"` (the mass-assignment guard). `*Read` models are the only
thing that leaves the API — never an ORM model.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.modules.communities.models import GATE_TYPES, STRUCTURE_TYPES, UNIT_TYPES

_Code = Annotated[
    str, Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9][A-Za-z0-9 _\-\/]*$")
]


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# --- Community ------------------------------------------------------------- #
class CommunityCreate(_Write):
    code: _Code
    name: str = Field(min_length=1, max_length=255)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str = Field(default="India", max_length=80)
    timezone: str = Field(default="Asia/Kolkata", max_length=64)


class CommunityUpdate(_Write):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=80)
    timezone: str | None = Field(default=None, max_length=64)
    is_active: bool | None = None


class CommunityRead(_Read):
    code: str
    name: str
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    postal_code: str | None
    country: str
    timezone: str
    is_active: bool


# --- Gate ----------------------------------------------------------------- #
class GateCreate(_Write):
    code: _Code
    name: str = Field(min_length=1, max_length=120)
    gate_type: str = Field(default="main")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class GateUpdate(_Write):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    gate_type: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    is_active: bool | None = None


class GateRead(_Read):
    community_id: uuid.UUID
    code: str
    name: str
    gate_type: str
    latitude: float | None
    longitude: float | None
    is_active: bool


# --- Tower -------------------------------------------------------------- #
class TowerCreate(_Write):
    code: _Code
    name: str = Field(min_length=1, max_length=128)
    structure_type: str = Field(default="tower")
    total_floors: int = Field(default=0, ge=0, le=300)


class TowerUpdate(_Write):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    structure_type: str | None = None
    total_floors: int | None = Field(default=None, ge=0, le=300)
    is_active: bool | None = None


class TowerRead(_Read):
    community_id: uuid.UUID
    code: str
    name: str
    structure_type: str
    total_floors: int
    is_active: bool


# --- Floor ------------------------------------------------------------- #
class FloorCreate(_Write):
    tower_id: uuid.UUID
    floor_number: int = Field(ge=-10, le=300)
    label: str | None = Field(default=None, max_length=40)


class FloorUpdate(_Write):
    label: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None


class FloorRead(_Read):
    community_id: uuid.UUID
    tower_id: uuid.UUID
    floor_number: int
    label: str | None
    is_active: bool


# --- Unit ------------------------------------------------------------ #
class UnitCreate(_Write):
    floor_id: uuid.UUID
    unit_number: str = Field(min_length=1, max_length=32)
    unit_type: str = Field(default="apartment")
    bedrooms: int | None = Field(default=None, ge=0, le=20)
    area_sqft: float | None = Field(default=None, gt=0, le=1_000_000)


class UnitUpdate(_Write):
    unit_number: str | None = Field(default=None, min_length=1, max_length=32)
    unit_type: str | None = None
    bedrooms: int | None = Field(default=None, ge=0, le=20)
    area_sqft: float | None = Field(default=None, gt=0, le=1_000_000)
    is_active: bool | None = None


class UnitRead(_Read):
    community_id: uuid.UUID
    tower_id: uuid.UUID
    floor_id: uuid.UUID
    unit_number: str
    unit_type: str
    bedrooms: int | None
    area_sqft: float | None
    is_active: bool


ALLOWED = {
    "gate_type": set(GATE_TYPES),
    "structure_type": set(STRUCTURE_TYPES),
    "unit_type": set(UNIT_TYPES),
}

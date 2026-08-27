"""Pydantic models for User & Role management (FR-02). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


_Phone = Field(default=None, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")


class UserCreate(_Write):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=10, max_length=200)
    phone: str | None = _Phone
    role_slug: str | None = None
    community_id: uuid.UUID | None = None


class UserUpdate(_Write):
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = _Phone
    is_active: bool | None = None


class RoleGrantIn(_Write):
    role_slug: str
    community_id: uuid.UUID | None = None


class RoleGrantRead(_Read):
    user_id: uuid.UUID
    role_id: uuid.UUID
    role_slug: str
    role_name: str
    community_id: uuid.UUID | None


class UserRead(_Read):
    email: str
    full_name: str
    phone: str | None
    is_active: bool
    is_superadmin: bool
    roles: list[RoleGrantRead] = []


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    permissions: list[str] = []

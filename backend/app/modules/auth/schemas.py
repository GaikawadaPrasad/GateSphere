"""Auth request/response models."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class CurrentUser(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_superadmin: bool
    permissions: list[str]

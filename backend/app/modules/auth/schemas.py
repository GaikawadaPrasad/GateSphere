"""Auth request/response models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class CurrentUser(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_superadmin: bool
    permissions: list[str]
    community_ids: list[str]
    # bumps when the caller's effective permissions may have changed; the frontend
    # polls `/auth/me` and refreshes its permission cache when this value moves.
    permission_version: int = 0

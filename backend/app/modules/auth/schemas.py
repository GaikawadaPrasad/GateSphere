"""Auth request/response models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    # Which role to open the session as. Required only when the account holds more than
    # one role; ignored for Super Admin. Determines the `gatesphere_<bucket>_session` cookie.
    role: str | None = Field(default=None, max_length=64)


class CurrentUser(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_superadmin: bool
    permissions: list[str]
    community_ids: list[str]
    # the role + bucket this session was opened as (None for a legacy `gs_session`)
    active_role: str | None = None
    session_bucket: str | None = None
    # bumps when the caller's effective permissions may have changed; the frontend
    # polls `/auth/me` and refreshes its permission cache when this value moves.
    permission_version: int = 0

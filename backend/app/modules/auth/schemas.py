"""Auth request/response models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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
    phone: str | None = None
    is_superadmin: bool
    permissions: list[str]
    community_ids: list[str]
    # the role + bucket this session was opened as (None for a legacy `gs_session`)
    active_role: str | None = None
    session_bucket: str | None = None
    # bumps when the caller's effective permissions may have changed; the frontend
    # polls `/auth/me` and refreshes its permission cache when this value moves.
    permission_version: int = 0


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20, pattern=r"^[+0-9][0-9 \-]{4,19}$")

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> ProfileUpdateRequest:
        if self.full_name is None and self.phone is None:
            raise ValueError("At least one profile field must be provided for update")
        return self


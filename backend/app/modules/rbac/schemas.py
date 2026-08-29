"""Pydantic models for configurable RBAC. Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PermissionRead(BaseModel):
    code: str
    description: str | None = None


class RolePermsRead(BaseModel):
    slug: str
    name: str
    description: str | None = None
    is_wildcard: bool = False
    permissions: list[str] = []
    default_permissions: list[str] = []


class RolePermsSet(_Write):
    permissions: list[str] = Field(min_length=0)


class PermCodeIn(_Write):
    code: str = Field(min_length=3, max_length=128)


class CommunityOverrideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    community_id: uuid.UUID
    role_id: uuid.UUID
    role_slug: str
    permission_code: str
    effect: Literal["allow", "deny"]
    note: str | None = None


class CommunityRoleOverridesSet(_Write):
    allow: list[str] = []
    deny: list[str] = []
    note: str | None = Field(default=None, max_length=255)


class EffectivePermsRead(BaseModel):
    community_id: uuid.UUID
    role_slug: str
    default_permissions: list[str]
    allow: list[str]
    deny: list[str]
    effective_permissions: list[str]

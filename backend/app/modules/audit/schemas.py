"""Pydantic read models for the Audit Logging query API (FR-16)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    community_id: uuid.UUID | None
    user_id: uuid.UUID | None
    session_id: uuid.UUID | None
    role_slug: str | None
    module: str
    action: str
    entity_type: str | None
    entity_id: str | None
    old_values: dict | None
    new_values: dict | None
    ip_address: str | None
    user_agent: str | None

    @field_validator("ip_address", mode="before")
    @classmethod
    def _ip_to_str(cls, v: object) -> str | None:
        # `audit_logs.ip_address` is a PostgreSQL INET column; psycopg returns it as an
        # `ipaddress.IPv4Address`/`IPv6Address`, which a plain `str` field will not coerce.
        return None if v is None else str(v)

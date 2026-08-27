"""Pydantic read models for the Audit Logging query API (FR-16)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    community_id: uuid.UUID | None
    user_id: uuid.UUID | None
    session_id: uuid.UUID | None
    module: str
    action: str
    entity_type: str | None
    entity_id: str | None
    old_values: dict | None
    new_values: dict | None
    ip_address: str | None
    user_agent: str | None

"""Immutable audit log (FR-16). Append-only — enforced by a DB trigger
(`gs_audit_logs_immutable`, migration 0028) that RAISEs on any UPDATE or DELETE, so the
guarantee holds even for a superuser / a direct `psql` session, not just the app.

Columns match AGENTS.md §10: community_id, user_id, session_id, role_slug, action, module,
entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, pk


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    community_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column()
    # the role the actor was acting AS at the time (point-in-time; the actor's grants may
    # change later). None for system jobs and legacy rows.
    role_slug: Mapped[str | None] = mapped_column(String(48))
    module: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64))
    entity_type: Mapped[str | None] = mapped_column(String(64))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    old_values: Mapped[dict | None] = mapped_column(JSONB)
    new_values: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))

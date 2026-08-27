"""Emergency & Incident Management (FR-13): security incidents (optionally raised from a
FR-05 panic alert), append-only status history + action log, and responder assignments.

Tenant tables carry `community_id`; child tables are reached through the incident.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

INCIDENT_TYPES = (
    "medical",
    "fire",
    "theft",
    "suspicious",
    "breach",
    "lift_entrapment",
    "assault",
    "natural",
    "other",
)
SEVERITIES = ("low", "medium", "high", "critical")
INCIDENT_STATUS = (
    "reported",
    "acknowledged",
    "responding",
    "contained",
    "resolved",
    "closed",
    "false_alarm",
)
ACTION_TYPES = (
    "note",
    "dispatch",
    "escalation",
    "authority_contacted",
    "evacuation",
    "medical_aid",
    "update",
)


class SecurityIncident(Base, TimestampMixin, TenantMixin):
    __tablename__ = "security_incidents"
    __table_args__ = (
        UniqueConstraint("community_id", "incident_number"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    incident_number: Mapped[str] = mapped_column(String(40))
    incident_type: Mapped[str] = mapped_column(String(20))
    severity: Mapped[str] = mapped_column(String(10), default="medium", index=True)
    status: Mapped[str] = mapped_column(String(15), default="reported", index=True)
    tower_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("towers.id", ondelete="SET NULL"))
    unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("units.id", ondelete="SET NULL"))
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    location_text: Mapped[str | None] = mapped_column(String(255))
    reporter_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    panic_alert_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("panic_alerts.id", ondelete="SET NULL")
    )
    description: Mapped[str | None] = mapped_column(Text)
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_summary: Mapped[str | None] = mapped_column(Text)

    history: Mapped[list[IncidentStatusHistory]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    assignments: Mapped[list[IncidentAssignment]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    actions: Mapped[list[IncidentAction]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )


class IncidentStatusHistory(Base, TimestampMixin, TenantMixin):
    __tablename__ = "incident_status_history"

    id: Mapped[uuid.UUID] = pk()
    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("security_incidents.id", ondelete="CASCADE"), index=True
    )
    old_status: Mapped[str | None] = mapped_column(String(15))
    new_status: Mapped[str] = mapped_column(String(15))
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reason: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    incident: Mapped[SecurityIncident] = relationship(back_populates="history")


class IncidentAssignment(Base, TimestampMixin):
    __tablename__ = "incident_assignments"

    id: Mapped[uuid.UUID] = pk()
    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("security_incidents.id", ondelete="CASCADE"), index=True
    )
    assigned_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    assigned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    incident: Mapped[SecurityIncident] = relationship(back_populates="assignments")


class IncidentAction(Base, TimestampMixin):
    __tablename__ = "incident_actions"

    id: Mapped[uuid.UUID] = pk()
    incident_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("security_incidents.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    action_type: Mapped[str] = mapped_column(String(24))
    details: Mapped[str | None] = mapped_column(Text)
    action_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )

    incident: Mapped[SecurityIncident] = relationship(back_populates="actions")

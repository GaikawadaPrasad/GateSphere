"""Gate / Security Operations (FR-05): append-only gate event log, guard rosters,
gate assignments, and panic (SOS) alerts.

All tables are tenant-scoped (`community_id`). `gate_events` is append-only — no update
or delete path exists in the service layer.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

EVENT_TYPES = (
    "visitor_in",
    "visitor_out",
    "delivery_in",
    "delivery_out",
    "staff_in",
    "staff_out",
    "vehicle_in",
    "vehicle_out",
    "patrol_check",
    "manual_note",
    "gate_open",
    "gate_close",
    "checkpoint_override",  # supervisor manually overrides a gate checkpoint (FR-05)
)
ROSTER_STATUS = ("planned", "active", "completed", "cancelled")
ASSIGNMENT_STATUS = ("active", "ended")
ALERT_TYPES = ("medical", "fire", "security", "intrusion", "other")
ALERT_SEVERITY = ("low", "medium", "high", "critical")
ALERT_STATUS = ("active", "acknowledged", "resolved", "cancelled")


class GateEvent(Base, TimestampMixin, TenantMixin):
    __tablename__ = "gate_events"
    __table_args__ = (
        Index("ix_gate_events_community_gate_time", "community_id", "gate_id", "occurred_at"),
    )

    id: Mapped[uuid.UUID] = pk()
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    event_type: Mapped[str] = mapped_column(String(20))
    reference_type: Mapped[str | None] = mapped_column(String(40))
    reference_id: Mapped[uuid.UUID | None] = mapped_column()
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)


class GuardRoster(Base, TimestampMixin, TenantMixin):
    __tablename__ = "guard_rosters"
    __table_args__ = (
        UniqueConstraint("id", "community_id"),
        UniqueConstraint("community_id", "guard_user_id", "shift_date", "shift_start"),
    )

    id: Mapped[uuid.UUID] = pk()
    guard_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    supervisor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    shift_date: Mapped[date] = mapped_column(Date, index=True)
    shift_start: Mapped[time] = mapped_column(Time)
    shift_end: Mapped[time] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(12), default="planned", index=True)
    notes: Mapped[str | None] = mapped_column(Text)


class GateAssignment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "gate_assignments"

    id: Mapped[uuid.UUID] = pk()
    guard_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    gate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gates.id", ondelete="CASCADE"))
    roster_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("guard_rosters.id", ondelete="SET NULL")
    )
    assigned_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    assigned_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)


class PanicAlert(Base, TimestampMixin, TenantMixin):
    __tablename__ = "panic_alerts"

    id: Mapped[uuid.UUID] = pk()
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    alert_type: Mapped[str] = mapped_column(String(12), default="other")
    severity: Mapped[str] = mapped_column(String(10), default="high")
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="active", index=True)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    acknowledged_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_summary: Mapped[str | None] = mapped_column(Text)

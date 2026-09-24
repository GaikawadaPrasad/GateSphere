"""Delivery Management (FR-07): per-community delivery protocols (config-as-data),
delivery records with an approval + arrival workflow, and an append-only event log.

All tables are tenant-scoped (`community_id`) with composite tenant-safe FKs to `units`
and `delivery_protocols`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk
from app.modules.communities.models import Unit

DELIVERY_TYPES = (
    "food",
    "grocery",
    "ecommerce",
    "courier",
    "medicine",
    "pharmacy",
    "laundry",
    "other",
)
PROTOCOL_TYPES = (
    "allow_at_gate",
    "resident_approval_required",
    "leave_at_gate_desk",
    "direct_rejection",
    # Legacy aliases for backward compatibility
    "leave_at_gate",
    "collect_at_gate",
    "direct_to_door",
    "call_resident",
)
# The four PRD protocols (FR-07). They alone decide routing; the `allow_direct_entry` /
# `leave_at_gate` flags are derived from them and only consulted for legacy types.
CANONICAL_PROTOCOLS = frozenset(PROTOCOL_TYPES[:4])
# Protocols whose parcel is left at the gate desk and handed over there (`/collect`).
GATE_DESK_PROTOCOLS = frozenset({"leave_at_gate_desk", "leave_at_gate", "collect_at_gate"})
APPROVAL_STATUS = ("pending", "approved", "rejected", "auto_approved")
DELIVERY_STATUS = (
    "expected",
    "at_gate",
    "in_transit",
    "delivered",
    "collected",
    "returned",
    "cancelled",
)
EVENT_TYPES = ("logged", "arrived", "approved", "rejected", "entered", "delivered", "exited")


class DeliveryProtocol(Base, TimestampMixin, TenantMixin):
    __tablename__ = "delivery_protocols"
    __table_args__ = (
        UniqueConstraint("id", "community_id"),
        Index(
            "uq_delivery_protocols_community_default",
            "community_id",
            "delivery_type",
            unique=True,
            postgresql_where=text("unit_id IS NULL"),
        ),
        Index(
            "uq_delivery_protocols_unit_override",
            "community_id",
            "unit_id",
            "delivery_type",
            unique=True,
            postgresql_where=text("unit_id IS NOT NULL"),
        ),
        CheckConstraint(
            "protocol_type IN ('allow_at_gate', 'resident_approval_required', 'leave_at_gate_desk', 'direct_rejection', 'leave_at_gate', 'collect_at_gate', 'direct_to_door', 'call_resident')",
            name="ck_delivery_protocol_type",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("units.id", ondelete="CASCADE"), nullable=True
    )
    delivery_type: Mapped[str] = mapped_column(String(20))
    protocol_type: Mapped[str] = mapped_column(String(40), default="resident_approval_required")
    requires_otp: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_direct_entry: Mapped[bool] = mapped_column(Boolean, default=False)
    leave_at_gate: Mapped[bool] = mapped_column(Boolean, default=True)
    allowed_start_time: Mapped[time | None] = mapped_column(Time)
    allowed_end_time: Mapped[time | None] = mapped_column(Time)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Delivery(Base, TimestampMixin, TenantMixin):
    __tablename__ = "deliveries"
    __table_args__ = (
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["protocol_id", "community_id"],
            ["delivery_protocols.id", "delivery_protocols.community_id"],
            ondelete="SET NULL",
        ),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    resident_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    protocol_id: Mapped[uuid.UUID | None] = mapped_column()
    delivery_type: Mapped[str] = mapped_column(String(20))
    provider_name: Mapped[str | None] = mapped_column(String(120))
    executive_name: Mapped[str | None] = mapped_column(String(120))
    executive_phone: Mapped[str | None] = mapped_column(String(20))
    tracking_reference: Mapped[str | None] = mapped_column(String(120))
    approval_status: Mapped[str] = mapped_column(String(15), default="pending", index=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(15), default="expected", index=True)
    parcel_count: Mapped[int] = mapped_column(Integer, default=1)
    notes: Mapped[str | None] = mapped_column(Text)

    unit: Mapped[Unit | None] = relationship(
        "Unit",
        foreign_keys=[unit_id],
        primaryjoin="Delivery.unit_id == Unit.id",
        lazy="selectin",
    )

    @property
    def unit_number(self) -> str | None:
        return self.unit.unit_number if self.unit else None

    # The protocol this delivery was routed by (community- or unit-level). Exposed so the
    # guard console can offer the right hand-over action without re-deriving routing.
    protocol: Mapped[DeliveryProtocol | None] = relationship(
        "DeliveryProtocol",
        foreign_keys=[protocol_id],
        primaryjoin="Delivery.protocol_id == DeliveryProtocol.id",
        lazy="selectin",
        viewonly=True,
    )

    @property
    def protocol_type(self) -> str | None:
        return self.protocol.protocol_type if self.protocol else None

    events: Mapped[list[DeliveryEvent]] = relationship(
        back_populates="delivery", cascade="all, delete-orphan"
    )


class DeliveryEvent(Base, TimestampMixin):
    __tablename__ = "delivery_events"

    id: Mapped[uuid.UUID] = pk()
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deliveries.id", ondelete="CASCADE"), index=True
    )
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    event_type: Mapped[str] = mapped_column(String(15))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    remarks: Mapped[str | None] = mapped_column(Text)
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)

    delivery: Mapped[Delivery] = relationship(back_populates="events")

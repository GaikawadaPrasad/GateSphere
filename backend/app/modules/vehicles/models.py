"""Vehicle & Parking (FR-08): vehicle registry (resident XOR visitor owned), parking
slots, active slot allocations, automated gate entry logging, parking violations, and
per-community parking rules (config-as-data).

All tables are tenant-scoped (`community_id`).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

VEHICLE_TYPES = ("car", "bike", "scooter", "bicycle", "ev_car", "ev_bike", "commercial", "other")
SLOT_TYPES = ("car", "bike", "ev", "visitor", "accessible")
SLOT_STATUS = ("available", "allocated", "reserved", "blocked")
ALLOCATION_STATUS = ("active", "released")
ENTRY_STATUS = ("inside", "exited")
ENTRY_SOURCE = ("resident", "visitor", "delivery", "staff", "unknown")
VIOLATION_TYPES = ("wrong_slot", "no_sticker", "blocking", "unauthorized", "expired_pass", "other")
VIOLATION_STATUS = ("open", "acknowledged", "resolved", "waived")


class Vehicle(Base, TimestampMixin, TenantMixin):
    __tablename__ = "vehicles"
    __table_args__ = (
        UniqueConstraint("community_id", "registration_number"),
        UniqueConstraint("id", "community_id"),
        CheckConstraint(
            "(resident_profile_id IS NOT NULL) <> (visitor_id IS NOT NULL)",
            name="ck_vehicle_owner_xor",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    resident_profile_id: Mapped[uuid.UUID | None] = mapped_column()
    visitor_id: Mapped[uuid.UUID | None] = mapped_column()
    unit_id: Mapped[uuid.UUID | None] = mapped_column()
    vehicle_type: Mapped[str] = mapped_column(String(15))
    registration_number: Mapped[str] = mapped_column(String(20))
    make: Mapped[str | None] = mapped_column(String(60))
    model: Mapped[str | None] = mapped_column(String(60))
    color: Mapped[str | None] = mapped_column(String(30))
    sticker_number: Mapped[str | None] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ParkingRule(Base, TimestampMixin, TenantMixin):
    __tablename__ = "parking_rules"
    __table_args__ = (UniqueConstraint("community_id"),)

    id: Mapped[uuid.UUID] = pk()
    allow_multi_slot_vehicle: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_guest_parking: Mapped[bool] = mapped_column(Boolean, default=True)
    max_active_slots_per_unit: Mapped[int] = mapped_column(Integer, default=2)
    violation_grace_minutes: Mapped[int] = mapped_column(Integer, default=30)


class ParkingSlot(Base, TimestampMixin, TenantMixin):
    __tablename__ = "parking_slots"
    __table_args__ = (
        UniqueConstraint("community_id", "slot_code"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    tower_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("towers.id", ondelete="SET NULL"))
    slot_code: Mapped[str] = mapped_column(String(20))
    slot_type: Mapped[str] = mapped_column(String(15), default="car")
    level: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(12), default="available", index=True)
    is_guest_slot: Mapped[bool] = mapped_column(Boolean, default=False)
    reserved_for_unit_id: Mapped[uuid.UUID | None] = mapped_column()


class ParkingAllocation(Base, TimestampMixin, TenantMixin):
    __tablename__ = "parking_allocations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["slot_id", "community_id"],
            ["parking_slots.id", "parking_slots.community_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["vehicle_id", "community_id"],
            ["vehicles.id", "vehicles.community_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "allocated_to IS NULL OR allocated_to > allocated_from",
            name="ck_parking_allocation_window",
        ),
        Index(
            "uq_parking_slot_active",
            "slot_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index(
            "uq_parking_vehicle_active",
            "vehicle_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    slot_id: Mapped[uuid.UUID] = mapped_column(index=True)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column()
    allocated_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    allocated_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)
    allocated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class VehicleEntry(Base, TimestampMixin, TenantMixin):
    __tablename__ = "vehicle_entries"
    __table_args__ = (
        CheckConstraint("exit_at IS NULL OR exit_at >= entry_at", name="ck_vehicle_entry_window"),
    )

    id: Mapped[uuid.UUID] = pk()
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column()
    registration_number: Mapped[str] = mapped_column(String(20), index=True)
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    entry_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    exit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entry_guard_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    exit_guard_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    source_type: Mapped[str] = mapped_column(String(10), default="unknown")
    reference_id: Mapped[uuid.UUID | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(10), default="inside", index=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)


class ParkingViolation(Base, TimestampMixin, TenantMixin):
    __tablename__ = "parking_violations"

    id: Mapped[uuid.UUID] = pk()
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column()
    parking_slot_id: Mapped[uuid.UUID | None] = mapped_column()
    reported_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    violation_type: Mapped[str] = mapped_column(String(15))
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    evidence_url: Mapped[str | None] = mapped_column(Text)
    fine_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(12), default="open", index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

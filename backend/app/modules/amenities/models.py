"""Amenity Booking (FR-11): amenities, weekly availability slots, config-as-data booking
rules, maintenance blocks, and resident bookings with an atomic overlap/capacity check.

All tenant tables carry `community_id` with composite tenant-safe FKs.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

AMENITY_TYPES = (
    "clubhouse",
    "gym",
    "pool",
    "tennis",
    "hall",
    "guest_room",
    "park",
    "other",
)
RULE_TYPES = (
    "max_advance_days",
    "max_active_per_unit",
    "min_cancel_hours",
    "max_hours_per_booking",
)
BOOKING_STATUS = ("confirmed", "cancelled", "completed", "no_show")
DAYS = (0, 1, 2, 3, 4, 5, 6)  # Monday..Sunday


class Amenity(Base, TimestampMixin, TenantMixin):
    __tablename__ = "amenities"
    __table_args__ = (
        UniqueConstraint("community_id", "code"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(120))
    amenity_type: Mapped[str] = mapped_column(String(20), default="other")
    location_text: Mapped[str | None] = mapped_column(String(255))
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    booking_required: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    slots: Mapped[list[AmenitySlot]] = relationship(
        back_populates="amenity", cascade="all, delete-orphan"
    )


class AmenitySlot(Base, TimestampMixin, TenantMixin):
    __tablename__ = "amenity_slots"
    __table_args__ = (
        ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("id", "community_id"),
        CheckConstraint("end_time > start_time", name="ck_amenity_slot_window"),
    )

    id: Mapped[uuid.UUID] = pk()
    amenity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    day_of_week: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    capacity: Mapped[int | None] = mapped_column(Integer)
    fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    amenity: Mapped[Amenity] = relationship(back_populates="slots")


class AmenityRule(Base, TimestampMixin, TenantMixin):
    __tablename__ = "amenity_rules"
    __table_args__ = (
        ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("community_id", "amenity_id", "rule_type"),
    )

    id: Mapped[uuid.UUID] = pk()
    amenity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    rule_type: Mapped[str] = mapped_column(String(30))
    rule_value: Mapped[dict] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AmenityBlock(Base, TimestampMixin, TenantMixin):
    __tablename__ = "amenity_blocks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("blocked_to > blocked_from", name="ck_amenity_block_window"),
    )

    id: Mapped[uuid.UUID] = pk()
    amenity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    blocked_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    blocked_to: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class AmenityBooking(Base, TimestampMixin, TenantMixin):
    __tablename__ = "amenity_bookings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        CheckConstraint("end_at > start_at", name="ck_amenity_booking_window"),
    )

    id: Mapped[uuid.UUID] = pk()
    amenity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    slot_id: Mapped[uuid.UUID | None] = mapped_column()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    resident_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    booking_date: Mapped[date] = mapped_column(Date, index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    participant_count: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(12), default="confirmed", index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)

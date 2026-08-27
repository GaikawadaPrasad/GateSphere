"""Domestic Staff (FR-06): staff directory, multi-unit work assignments, gate
attendance (check-in / check-out), and resident ratings.

All tables are tenant-scoped (`community_id`) with composite tenant-safe FKs to `units`.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

STAFF_TYPES = (
    "maid",
    "cook",
    "driver",
    "nanny",
    "caretaker",
    "gardener",
    "nurse",
    "other",
)
VERIFICATION_STATUS = ("not_started", "pending", "verified", "rejected", "expired")
WORK_TYPES = ("full_time", "part_time", "on_call", "daily_help")
ATTENDANCE_STATUS = ("inside", "left", "absent")


class DomesticStaff(Base, TimestampMixin, TenantMixin):
    __tablename__ = "domestic_staff"
    __table_args__ = (
        UniqueConstraint("community_id", "phone"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    full_name: Mapped[str] = mapped_column(String(180))
    staff_type: Mapped[str] = mapped_column(String(20))
    phone: Mapped[str] = mapped_column(String(20))
    photo_url: Mapped[str | None] = mapped_column(Text)
    id_type: Mapped[str | None] = mapped_column(String(30))
    id_number_hash: Mapped[str | None] = mapped_column(String(128))
    police_verification_status: Mapped[str] = mapped_column(String(15), default="not_started")
    verification_expiry: Mapped[date | None] = mapped_column(Date)
    emergency_address: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StaffUnitAssignment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "staff_unit_assignments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["staff_id", "community_id"],
            ["domestic_staff.id", "domestic_staff.community_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR start_date <= end_date",
            name="ck_staff_assignment_dates",
        ),
        Index(
            "uq_staff_unit_active",
            "staff_id",
            "unit_id",
            unique=True,
            postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    staff_id: Mapped[uuid.UUID] = mapped_column(index=True)
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    work_type: Mapped[str] = mapped_column(String(15), default="part_time")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    time_from: Mapped[time | None] = mapped_column(Time)
    time_to: Mapped[time | None] = mapped_column(Time)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class StaffAttendance(Base, TimestampMixin, TenantMixin):
    __tablename__ = "staff_attendance"
    __table_args__ = (
        ForeignKeyConstraint(
            ["staff_id", "community_id"],
            ["domestic_staff.id", "domestic_staff.community_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "check_out_at IS NULL OR check_out_at >= check_in_at",
            name="ck_staff_attendance_window",
        ),
        Index(
            "uq_staff_attendance_open",
            "staff_id",
            unique=True,
            postgresql_where=text("check_out_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    staff_id: Mapped[uuid.UUID] = mapped_column(index=True)
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    check_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_in_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    check_out_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    attendance_status: Mapped[str] = mapped_column(String(10), default="inside", index=True)


class StaffRating(Base, TimestampMixin, TenantMixin):
    __tablename__ = "staff_ratings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["staff_id", "community_id"],
            ["domestic_staff.id", "domestic_staff.community_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_staff_rating_range"),
        UniqueConstraint("staff_id", "unit_id", "resident_user_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    staff_id: Mapped[uuid.UUID] = mapped_column(index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column()
    resident_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    rating: Mapped[int] = mapped_column(SmallInteger)
    feedback: Mapped[str | None] = mapped_column(Text)

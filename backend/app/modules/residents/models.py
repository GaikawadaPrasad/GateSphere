"""Residents (FR-03): resident profiles, unit occupancies, family members,
emergency contacts, statutory move-in/move-out records.

All tables are tenant-scoped (`community_id`) and reference their parents with composite
tenant-safe FKs so a row can never point at a parent in another community.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

PROFILE_STATUS = ("pending", "active", "moved_out", "suspended")
KYC_STATUS = ("not_started", "submitted", "verified", "rejected")
OCCUPANCY_ROLES = ("primary_owner", "secondary_owner", "tenant", "family", "occupant")
RELATIONSHIPS = ("spouse", "child", "parent", "sibling", "relative", "domestic_help", "other")
MOVE_TYPES = ("move_in", "move_out")
MOVE_STATUS = ("requested", "scheduled", "in_progress", "approved", "completed", "rejected", "cancelled")


class ResidentProfile(Base, TimestampMixin, TenantMixin):
    __tablename__ = "resident_profiles"
    __table_args__ = (
        UniqueConstraint("community_id", "user_id"),
        UniqueConstraint("id", "community_id"),  # composite-FK target
    )

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    profile_status: Mapped[str] = mapped_column(String(20), default="pending")
    kyc_status: Mapped[str] = mapped_column(String(20), default="not_started")
    move_in_date: Mapped[date | None] = mapped_column(Date)
    move_out_date: Mapped[date | None] = mapped_column(Date)
    emergency_notes: Mapped[str | None] = mapped_column(Text)

    occupancies: Mapped[list[UnitOccupancy]] = relationship(
        back_populates="resident_profile", cascade="all, delete-orphan"
    )
    emergency_contacts: Mapped[list[EmergencyContact]] = relationship(
        back_populates="resident_profile", cascade="all, delete-orphan"
    )


class UnitOccupancy(Base, TimestampMixin, TenantMixin):
    __tablename__ = "unit_occupancies"
    __table_args__ = (
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
        # one primary ACTIVE occupant per unit
        Index(
            "uq_unit_primary_active",
            "unit_id",
            unique=True,
            postgresql_where=text("is_primary AND is_active"),
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    resident_profile_id: Mapped[uuid.UUID] = mapped_column(index=True)
    occupancy_role: Mapped[str] = mapped_column(String(20))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    start_date: Mapped[date] = mapped_column(Date, server_default=text("CURRENT_DATE"))
    end_date: Mapped[date | None] = mapped_column(Date)
    agreement_reference: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    resident_profile: Mapped[ResidentProfile] = relationship(back_populates="occupancies")


class FamilyMember(Base, TimestampMixin, TenantMixin):
    __tablename__ = "family_members"
    __table_args__ = (
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["primary_resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    primary_resident_profile_id: Mapped[uuid.UUID] = mapped_column(index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    full_name: Mapped[str] = mapped_column(String(180))
    relationship_type: Mapped[str] = mapped_column("relationship", String(20))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    phone: Mapped[str | None] = mapped_column(String(20))
    access_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class EmergencyContact(Base, TimestampMixin, TenantMixin):
    __tablename__ = "emergency_contacts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    resident_profile_id: Mapped[uuid.UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(180))
    relationship_type: Mapped[str] = mapped_column("relationship", String(40))
    phone: Mapped[str] = mapped_column(String(20))
    alternate_phone: Mapped[str | None] = mapped_column(String(20))
    priority: Mapped[int] = mapped_column(SmallInteger, default=1)

    resident_profile: Mapped[ResidentProfile] = relationship(back_populates="emergency_contacts")


class MoveRecord(Base, TimestampMixin, TenantMixin):
    __tablename__ = "move_records"
    __table_args__ = (
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    resident_profile_id: Mapped[uuid.UUID] = mapped_column(index=True)
    move_type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="requested", index=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    clearance_notes: Mapped[str | None] = mapped_column(Text)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

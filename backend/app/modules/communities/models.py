"""Community & property hierarchy (FR-03): Community -> Tower -> Floor -> Unit, plus Gate.

`communities` is the multi-tenant isolation root and is NOT itself tenant-scoped. Every other
table here carries `community_id` (TenantMixin) and uses a **composite tenant-safe FK** to its
parent so a child can never reference a parent in another community.
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKeyConstraint,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

GATE_TYPES = ("main", "service", "visitor", "pedestrian", "emergency")
STRUCTURE_TYPES = ("tower", "block", "villa_cluster", "wing")
UNIT_TYPES = ("apartment", "villa", "penthouse", "studio", "shop", "office")


class Community(Base, TimestampMixin):
    __tablename__ = "communities"

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(80), default="India")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    towers: Mapped[list[Tower]] = relationship(
        back_populates="community", cascade="all, delete-orphan"
    )
    gates: Mapped[list[Gate]] = relationship(
        back_populates="community", cascade="all, delete-orphan"
    )


class Gate(Base, TimestampMixin, TenantMixin):
    __tablename__ = "gates"
    __table_args__ = (UniqueConstraint("community_id", "code"),)

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120))
    gate_type: Mapped[str] = mapped_column(String(20), default="main")
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    community: Mapped[Community] = relationship(back_populates="gates")


class Tower(Base, TimestampMixin, TenantMixin):
    __tablename__ = "towers"
    __table_args__ = (
        UniqueConstraint("community_id", "name"),
        UniqueConstraint("id", "community_id"),  # target for children's composite FK
    )

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(128))
    structure_type: Mapped[str] = mapped_column(String(20), default="tower")
    total_floors: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    community: Mapped[Community] = relationship(back_populates="towers")
    floors: Mapped[list[Floor]] = relationship(back_populates="tower", cascade="all, delete-orphan")


class Floor(Base, TimestampMixin, TenantMixin):
    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint("community_id", "tower_id", "floor_number"),
        UniqueConstraint("id", "community_id", "tower_id"),
        ForeignKeyConstraint(
            ["tower_id", "community_id"],
            ["towers.id", "towers.community_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    tower_id: Mapped[uuid.UUID] = mapped_column(index=True)
    floor_number: Mapped[int] = mapped_column(SmallInteger)
    label: Mapped[str | None] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tower: Mapped[Tower] = relationship(back_populates="floors")
    units: Mapped[list[Unit]] = relationship(back_populates="floor", cascade="all, delete-orphan")


class Unit(Base, TimestampMixin, TenantMixin):
    __tablename__ = "units"
    __table_args__ = (
        UniqueConstraint("community_id", "tower_id", "floor_id", "unit_number"),
        ForeignKeyConstraint(
            ["floor_id", "community_id", "tower_id"],
            ["floors.id", "floors.community_id", "floors.tower_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    tower_id: Mapped[uuid.UUID] = mapped_column(index=True)
    floor_id: Mapped[uuid.UUID] = mapped_column(index=True)
    unit_number: Mapped[str] = mapped_column(String(32))  # e.g. "A-1203"
    unit_type: Mapped[str] = mapped_column(String(20), default="apartment")
    bedrooms: Mapped[int | None] = mapped_column(SmallInteger)
    area_sqft: Mapped[float | None] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    floor: Mapped[Floor] = relationship(back_populates="units")

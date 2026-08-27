"""Community & property hierarchy: Community -> Tower -> Floor -> Unit.

This is the multi-tenant isolation root. Every tenant-scoped table in every other module
carries `community_id` and must be filtered by the caller's community on every query.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin, uuid_pk


class Community(Base, TimestampMixin):
    __tablename__ = "communities"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    address: Mapped[str | None] = mapped_column(String(1024))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")

    towers: Mapped[list[Tower]] = relationship(
        back_populates="community", cascade="all, delete-orphan"
    )


class Tower(Base, TimestampMixin):
    __tablename__ = "towers"
    __table_args__ = (UniqueConstraint("community_id", "name"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    floors_count: Mapped[int] = mapped_column(Integer, default=0)

    community: Mapped[Community] = relationship(back_populates="towers")
    floors: Mapped[list[Floor]] = relationship(back_populates="tower", cascade="all, delete-orphan")


class Floor(Base, TimestampMixin):
    __tablename__ = "floors"
    __table_args__ = (UniqueConstraint("tower_id", "number"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )
    tower_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("towers.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)

    tower: Mapped[Tower] = relationship(back_populates="floors")
    units: Mapped[list[Unit]] = relationship(back_populates="floor", cascade="all, delete-orphan")


class Unit(Base, TimestampMixin):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("community_id", "label"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )
    tower_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("towers.id", ondelete="CASCADE"), index=True
    )
    floor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(32))  # e.g. "A-1203"
    unit_type: Mapped[str] = mapped_column(
        String(32), default="apartment"
    )  # apartment|villa|penthouse
    bedrooms: Mapped[int | None] = mapped_column(Integer)

    floor: Mapped[Floor] = relationship(back_populates="units")

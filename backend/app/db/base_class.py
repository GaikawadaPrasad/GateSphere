"""Declarative base + shared column helpers for every model.

Identity: **UUID v4 primary keys, repo-wide** (see docs/decisions/ADR-009-identifiers.md —
a deliberate deviation from DB ERD v1.2's BIGINT identity columns, chosen so resource ids
are non-enumerable in a security product).

Every tenant-scoped table also carries `community_id` (see TenantMixin) and is filtered by
the caller's community on every query.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def pk() -> Mapped[uuid.UUID]:
    """UUID v4 primary key, generated in the application layer."""
    return mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)


# Backwards-compatible alias (older modules import `uuid_pk`).
uuid_pk = pk


def fk(
    target: str,
    *,
    index: bool = True,
    ondelete: str = "CASCADE",
    nullable: bool = False,
) -> Mapped[uuid.UUID]:
    return mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(target, ondelete=ondelete),
        index=index,
        nullable=nullable,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TenantMixin:
    """Mix into every tenant-scoped model. `community_id` is filtered on every query."""

    community_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("communities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

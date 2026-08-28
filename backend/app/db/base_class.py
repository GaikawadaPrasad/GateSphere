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
from typing import Any, ClassVar

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    # eager_defaults => server-generated columns (created_at, and especially
    # `updated_at` on UPDATE) are fetched via RETURNING in the same statement.
    # Without this, an AsyncSession expires `updated_at` after an UPDATE flush and
    # serializing the returned ORM object triggers a forbidden lazy DB load
    # (MissingGreenlet). PostgreSQL supports RETURNING for both INSERT and UPDATE.
    __mapper_args__: ClassVar[dict[str, Any]] = {"eager_defaults": True}


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

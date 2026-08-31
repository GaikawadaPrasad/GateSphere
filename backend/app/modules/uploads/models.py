"""`managed_files` — one row per presigned upload (NFR-SEC-07).

`presign` inserts a `pending` row; the client PUTs the bytes; `confirm` HEADs the object,
sniffs its magic number and verifies size, then flips the row to `confirmed` (or deletes
the object and marks it `rejected`). A domain record may only reference a `confirmed` file
(`app.modules.uploads.guard.ensure_confirmed`).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin, pk

STATUSES = ("pending", "confirmed", "rejected")


class ManagedFile(Base, TimestampMixin):
    __tablename__ = "managed_files"

    id: Mapped[uuid.UUID] = pk()
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )
    object_key: Mapped[str] = mapped_column(String(400), unique=True)
    kind: Mapped[str] = mapped_column(String(40))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    declared_content_type: Mapped[str] = mapped_column(String(120))
    declared_size_bytes: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    detected_content_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    reject_reason: Mapped[str | None] = mapped_column(String(200))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

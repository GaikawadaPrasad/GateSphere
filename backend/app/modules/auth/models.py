"""Auth persistence: the session store.

`user_sessions` is the **system of record** for logged-in sessions (per DB ERD v1.2 §01 and
AGENTS.md §7). Redis only caches the lookup. The cookie carries an opaque token; only its
SHA-256 hash is stored here. Password hashing (Argon2) lives in app/core/security.py.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, pk


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    session_key_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

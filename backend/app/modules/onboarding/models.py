"""Tenant onboarding — community invitations (FR-03).

A community admin/owner issues an invitation for a specific unit (flat) with the invitee's
email/phone and the occupancy details. The invitee opens `accept_url`, signs in (or sets a
password if new), fills the remaining profile fields, and a `resident_profile` +
`unit_occupancy` + `resident` role grant are created in one transaction.
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
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

INVITATION_STATUS = ("pending", "accepted", "revoked", "expired")


class CommunityInvitation(Base, TimestampMixin, TenantMixin):
    __tablename__ = "community_invitations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')", name="ck_invitation_status"
        ),
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    invited_email: Mapped[str] = mapped_column(String(255), index=True)
    invited_phone: Mapped[str | None] = mapped_column(String(20))
    full_name: Mapped[str | None] = mapped_column(String(255))
    role_slug: Mapped[str] = mapped_column(String(64), server_default="resident")
    occupancy_role: Mapped[str] = mapped_column(String(20), server_default="tenant")
    is_primary: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    agreement_reference: Mapped[str | None] = mapped_column(String(120))
    message: Mapped[str | None] = mapped_column(Text)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(12), server_default="pending", index=True)
    invited_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    resident_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resident_profiles.id", ondelete="SET NULL")
    )

"""Visitor Management (FR-04): visitor records, blacklist, approval requests,
approvals, digital passes, gate entries, and the per-community policy.

Flow: guard/resident logs a request -> blacklist check -> (pre-approved pass ->
direct entry) OR resident approval -> entry stamp -> exit stamp -> permanent audit.
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
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

VISITOR_TYPES = (
    "personal_guest",
    "relative",
    "cab_taxi",
    "delivery_exec",
    "service_tech",
    "vendor",
    "interviewee",
    "event_guest",
    "recurring",
)
REQUEST_STATUS = ("pending", "approved", "rejected", "cancelled", "expired", "entered", "completed")
PASS_TYPES = ("qr", "pin", "otp")
RISK_LEVELS = ("low", "medium", "high")
ENTRY_STATUS = ("inside", "exited", "denied")
DECISIONS = ("approved", "rejected")


class Visitor(Base, TimestampMixin, TenantMixin):
    __tablename__ = "visitors"
    __table_args__ = (
        UniqueConstraint("community_id", "phone"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    full_name: Mapped[str] = mapped_column(String(180))
    phone: Mapped[str] = mapped_column(String(20))
    photo_url: Mapped[str | None] = mapped_column(Text)
    id_type: Mapped[str | None] = mapped_column(String(30))
    id_number_hash: Mapped[str | None] = mapped_column(String(128))
    vehicle_number: Mapped[str | None] = mapped_column(String(20))
    frequent_visitor_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    visit_count: Mapped[int] = mapped_column(Integer, default=0)
    last_visit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VisitorBlacklist(Base, TimestampMixin, TenantMixin):
    __tablename__ = "visitor_blacklist"

    id: Mapped[uuid.UUID] = pk()
    visitor_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    phone_hash: Mapped[str] = mapped_column(String(128), index=True)
    id_number_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    reason: Mapped[str] = mapped_column(Text)
    risk_level: Mapped[str] = mapped_column(String(10), default="medium")
    active_from: Mapped[date] = mapped_column(Date, server_default=text("CURRENT_DATE"))
    active_until: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class VisitorRequest(Base, TimestampMixin, TenantMixin):
    __tablename__ = "visitor_requests"
    __table_args__ = (
        ForeignKeyConstraint(
            ["visitor_id", "community_id"],
            ["visitors.id", "visitors.community_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    visitor_id: Mapped[uuid.UUID] = mapped_column(index=True)
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    host_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    visitor_type: Mapped[str] = mapped_column(String(20))
    purpose: Mapped[str | None] = mapped_column(String(255))
    expected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(15), default="pending", index=True)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    vehicle_number: Mapped[str | None] = mapped_column(String(20))
    group_label: Mapped[str | None] = mapped_column(String(120))
    party_size: Mapped[int] = mapped_column(SmallInteger, default=1)

    approvals: Mapped[list[VisitorApproval]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    passes: Mapped[list[VisitorPass]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class VisitorApproval(Base, TimestampMixin):
    __tablename__ = "visitor_approvals"
    __table_args__ = (UniqueConstraint("request_id", "approver_user_id"),)

    id: Mapped[uuid.UUID] = pk()
    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visitor_requests.id", ondelete="CASCADE"), index=True
    )
    approver_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    decision: Mapped[str] = mapped_column(String(10))
    remarks: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    request: Mapped[VisitorRequest] = relationship(back_populates="approvals")


class VisitorPass(Base, TimestampMixin):
    __tablename__ = "visitor_passes"

    id: Mapped[uuid.UUID] = pk()
    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("visitor_requests.id", ondelete="CASCADE"), index=True
    )
    pass_type: Mapped[str] = mapped_column(String(10), default="qr")
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    pin_hash: Mapped[str | None] = mapped_column(String(128))
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    valid_to: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    max_entries: Mapped[int] = mapped_column(SmallInteger, default=1)
    entry_count: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    request: Mapped[VisitorRequest] = relationship(back_populates="passes")


class VisitorEntry(Base, TimestampMixin, TenantMixin):
    __tablename__ = "visitor_entries"
    __table_args__ = (
        ForeignKeyConstraint(
            ["visitor_id", "community_id"],
            ["visitors.id", "visitors.community_id"],
            ondelete="CASCADE",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("visitor_requests.id", ondelete="SET NULL"), index=True
    )
    visitor_id: Mapped[uuid.UUID] = mapped_column(index=True)
    gate_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("gates.id", ondelete="SET NULL"))
    entry_guard_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    exit_guard_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    entry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    exit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entry_photo_url: Mapped[str | None] = mapped_column(Text)
    vehicle_number: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(10), default="inside", index=True)
    denial_reason: Mapped[str | None] = mapped_column(Text)


class VisitorRequestMember(Base, TimestampMixin, TenantMixin):
    """FR-04 multi-visitor grouping — a distinct visitor covered by one request/approval.

    The request's own `visitor_id` is also mirrored here as the `is_primary` member so the
    whole party can be listed and admitted from one place.
    """

    __tablename__ = "visitor_request_members"
    __table_args__ = (
        ForeignKeyConstraint(
            ["request_id", "community_id"],
            ["visitor_requests.id", "visitor_requests.community_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["visitor_id", "community_id"],
            ["visitors.id", "visitors.community_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("request_id", "visitor_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    request_id: Mapped[uuid.UUID] = mapped_column(index=True)
    visitor_id: Mapped[uuid.UUID] = mapped_column(index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class VisitorPolicy(Base, TimestampMixin, TenantMixin):
    __tablename__ = "visitor_policies"
    __table_args__ = (UniqueConstraint("community_id"),)

    id: Mapped[uuid.UUID] = pk()
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True)
    photo_required: Mapped[bool] = mapped_column(Boolean, default=True)
    otp_required: Mapped[bool] = mapped_column(Boolean, default=False)
    pass_ttl_minutes: Mapped[int] = mapped_column(Integer, default=240)
    blacklist_mode: Mapped[str] = mapped_column(String(20), default="block")  # block | warn

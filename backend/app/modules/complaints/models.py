"""Complaint & Service Desk (FR-10): service categories, SLA policies (config-as-data),
service tickets with an SLA-clocked lifecycle, append-only status history, assignments
(internal user XOR vendor), messages, and one feedback per ticket.

All tenant tables carry `community_id` with composite tenant-safe FKs.
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
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

PRIORITIES = ("low", "medium", "high", "critical")
TICKET_STATUS = (
    "created",
    "assigned",
    "acknowledged",
    "in_progress",
    "resolved",
    "resident_confirmation",
    "closed",
    "reopened",
    "cancelled",
)
CONFIRMATION_STATUS = ("pending", "confirmed", "disputed")


class ServiceCategory(Base, TimestampMixin, TenantMixin):
    __tablename__ = "service_categories"
    __table_args__ = (
        UniqueConstraint("community_id", "code"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(120))
    default_priority: Mapped[str] = mapped_column(String(10), default="medium")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SlaPolicy(Base, TimestampMixin, TenantMixin):
    __tablename__ = "sla_policies"
    __table_args__ = (
        ForeignKeyConstraint(
            ["category_id", "community_id"],
            ["service_categories.id", "service_categories.community_id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("community_id", "category_id", "priority"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    category_id: Mapped[uuid.UUID] = mapped_column(index=True)
    priority: Mapped[str] = mapped_column(String(10))
    response_minutes: Mapped[int] = mapped_column(Integer, default=120)
    resolution_minutes: Mapped[int] = mapped_column(Integer, default=1440)
    escalation_minutes: Mapped[int] = mapped_column(Integer, default=2880)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceTicket(Base, TimestampMixin, TenantMixin):
    __tablename__ = "service_tickets"
    __table_args__ = (
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["category_id", "community_id"],
            ["service_categories.id", "service_categories.community_id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("community_id", "ticket_number"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    ticket_number: Mapped[str] = mapped_column(String(40))
    raised_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    category_id: Mapped[uuid.UUID] = mapped_column(index=True)
    sla_policy_id: Mapped[uuid.UUID | None] = mapped_column()
    subject: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    status: Mapped[str] = mapped_column(String(24), default="created", index=True)
    resident_confirmation_status: Mapped[str] = mapped_column(String(12), default="pending")
    first_response_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    escalation_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sla_breached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    history: Mapped[list[TicketStatusHistory]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )
    assignments: Mapped[list[TicketAssignment]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )
    messages: Mapped[list[TicketMessage]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )


class TicketStatusHistory(Base, TimestampMixin):
    __tablename__ = "ticket_status_history"

    id: Mapped[uuid.UUID] = pk()
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str] = mapped_column(String(24))
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    remarks: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    ticket: Mapped[ServiceTicket] = relationship(back_populates="history")


class TicketAssignment(Base, TimestampMixin):
    __tablename__ = "ticket_assignments"
    __table_args__ = (
        CheckConstraint(
            "(assigned_to_user_id IS NOT NULL) <> (vendor_name IS NOT NULL)",
            name="ck_ticket_assignment_executor_xor",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), index=True
    )
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    vendor_name: Mapped[str | None] = mapped_column(String(160))
    assigned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    unassigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    ticket: Mapped[ServiceTicket] = relationship(back_populates="assignments")


class TicketMessage(Base, TimestampMixin):
    __tablename__ = "ticket_messages"

    id: Mapped[uuid.UUID] = pk()
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), index=True
    )
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    message: Mapped[str] = mapped_column(Text)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)

    ticket: Mapped[ServiceTicket] = relationship(back_populates="messages")


class TicketFeedback(Base, TimestampMixin):
    __tablename__ = "ticket_feedback"
    __table_args__ = (
        UniqueConstraint("ticket_id"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_ticket_feedback_rating"),
    )

    id: Mapped[uuid.UUID] = pk()
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("service_tickets.id", ondelete="CASCADE"), index=True
    )
    resident_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    rating: Mapped[int] = mapped_column(SmallInteger)
    comments: Mapped[str | None] = mapped_column(Text)

"""Communication & Broadcasts (FR-12): announcements with scoped targets, and polls
(options + responses). An announcement is a permanent record once published; a poll is
attached to its announcement.

Tenant tables carry `community_id`; child tables (targets, options, responses) are reached
only through their parent.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

ANNOUNCEMENT_TYPES = ("notice", "emergency", "poll", "event", "survey")
PRIORITIES = ("low", "normal", "high", "urgent")
POLL_STATUS = ("draft", "open", "closed")
RSVP_RESPONSES = ("going", "maybe", "not_going")


class Announcement(Base, TimestampMixin, TenantMixin):
    __tablename__ = "announcements"
    __table_args__ = (UniqueConstraint("id", "community_id"),)

    id: Mapped[uuid.UUID] = pk()
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    announcement_type: Mapped[str] = mapped_column(String(15), default="notice")
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(10), default="normal")
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    targets: Mapped[list[AnnouncementTarget]] = relationship(
        back_populates="announcement", cascade="all, delete-orphan"
    )
    poll: Mapped[Poll | None] = relationship(
        back_populates="announcement", cascade="all, delete-orphan", uselist=False
    )


class AnnouncementTarget(Base, TimestampMixin):
    __tablename__ = "announcement_targets"
    __table_args__ = (
        CheckConstraint(
            "target_all_community OR tower_id IS NOT NULL OR unit_id IS NOT NULL "
            "OR role_id IS NOT NULL OR resident_group_id IS NOT NULL",
            name="ck_announcement_target_valid",
        ),
    )

    id: Mapped[uuid.UUID] = pk()
    announcement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), index=True
    )
    tower_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("towers.id", ondelete="CASCADE"))
    unit_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"))
    role_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    resident_group_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resident_groups.id", ondelete="CASCADE")
    )
    target_all_community: Mapped[bool] = mapped_column(Boolean, default=False)

    announcement: Mapped[Announcement] = relationship(back_populates="targets")


class ResidentGroup(Base, TimestampMixin, TenantMixin):
    __tablename__ = "resident_groups"
    __table_args__ = (
        UniqueConstraint("community_id", "name"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    members: Mapped[list[ResidentGroupMember]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class ResidentGroupMember(Base, TimestampMixin):
    __tablename__ = "resident_group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)

    id: Mapped[uuid.UUID] = pk()
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("resident_groups.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    group: Mapped[ResidentGroup] = relationship(back_populates="members")


class Poll(Base, TimestampMixin, TenantMixin):
    __tablename__ = "polls"
    __table_args__ = (UniqueConstraint("announcement_id"),)

    id: Mapped[uuid.UUID] = pk()
    announcement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), index=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    question: Mapped[str] = mapped_column(String(400))
    allow_multiple: Mapped[bool] = mapped_column(Boolean, default=False)
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="draft", index=True)

    announcement: Mapped[Announcement] = relationship(back_populates="poll")
    options: Mapped[list[PollOption]] = relationship(
        back_populates="poll", cascade="all, delete-orphan"
    )


class PollOption(Base, TimestampMixin):
    __tablename__ = "poll_options"

    id: Mapped[uuid.UUID] = pk()
    poll_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("polls.id", ondelete="CASCADE"), index=True
    )
    option_text: Mapped[str] = mapped_column(String(200))
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    poll: Mapped[Poll] = relationship(back_populates="options")


class PollResponse(Base, TimestampMixin):
    __tablename__ = "poll_responses"
    __table_args__ = (UniqueConstraint("poll_id", "user_id"),)

    id: Mapped[uuid.UUID] = pk()
    poll_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("polls.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    responded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    selections: Mapped[list[PollResponseOption]] = relationship(cascade="all, delete-orphan")


class PollResponseOption(Base, TimestampMixin):
    __tablename__ = "poll_response_options"
    __table_args__ = (UniqueConstraint("response_id", "option_id"),)

    id: Mapped[uuid.UUID] = pk()
    response_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("poll_responses.id", ondelete="CASCADE"), index=True
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("poll_options.id", ondelete="CASCADE"), index=True
    )


class EventRSVP(Base, TimestampMixin, TenantMixin):
    """FR-12: a resident's response to an `event` announcement (GAP-2). One per user."""

    __tablename__ = "event_rsvps"
    __table_args__ = (UniqueConstraint("announcement_id", "user_id"),)

    id: Mapped[uuid.UUID] = pk()
    announcement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("announcements.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    response: Mapped[str] = mapped_column(String(10), index=True)  # going | maybe | not_going
    guests: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str | None] = mapped_column(String(500))

"""Notifications (FR-15): per-community templates, per-user delivered notifications,
append-only delivery attempts, and per-user channel preferences.

`notifications` and `notification_templates` are tenant-scoped; deliveries hang off a
notification; preferences are per user (nullable `community_id` = account default).
No real gateway — email/SMS/WhatsApp deliveries are simulated.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

CHANNELS = ("in_app", "email", "sms", "whatsapp", "push")
DELIVERY_STATUS = ("queued", "sent", "delivered", "failed", "skipped")


class NotificationTemplate(Base, TimestampMixin, TenantMixin):
    __tablename__ = "notification_templates"
    __table_args__ = (
        UniqueConstraint("community_id", "code", "channel"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(60))
    channel: Mapped[str] = mapped_column(String(12), default="in_app")
    title_template: Mapped[str] = mapped_column(String(300))
    body_template: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Notification(Base, TimestampMixin, TenantMixin):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = pk()
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column()
    notification_type: Mapped[str] = mapped_column(String(60), index=True)
    title: Mapped[str] = mapped_column(String(300))
    message: Mapped[str] = mapped_column(Text)
    reference_type: Mapped[str | None] = mapped_column(String(40))
    reference_id: Mapped[uuid.UUID | None] = mapped_column()
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    deliveries: Mapped[list[NotificationDelivery]] = relationship(
        back_populates="notification", cascade="all, delete-orphan"
    )


class NotificationDelivery(Base, TimestampMixin):
    __tablename__ = "notification_deliveries"

    id: Mapped[uuid.UUID] = pk()
    notification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notifications.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[str] = mapped_column(String(12))
    provider: Mapped[str] = mapped_column(String(40), default="simulated")
    status: Mapped[str] = mapped_column(String(12), default="queued")
    provider_message_id: Mapped[str | None] = mapped_column(String(120))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failure_reason: Mapped[str | None] = mapped_column(Text)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1)

    notification: Mapped[Notification] = relationship(back_populates="deliveries")


class UserNotificationPreference(Base, TimestampMixin):
    __tablename__ = "user_notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", "community_id", "channel"),)

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE")
    )
    channel: Mapped[str] = mapped_column(String(12))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    quiet_hours_start: Mapped[time | None] = mapped_column(Time)
    quiet_hours_end: Mapped[time | None] = mapped_column(Time)

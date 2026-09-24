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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

CHANNELS = ("in_app", "email", "sms", "whatsapp", "push")
# `simulated`: a mocked channel (SMS / WhatsApp / push / email in this build) recorded the
# message but no provider delivered it — never reported as `delivered` (re-audit #3, S-08).
DELIVERY_STATUS = ("queued", "sent", "delivered", "simulated", "failed", "skipped")
DEAD_LETTER_KINDS = ("single", "bulk", "broadcast_enqueue")


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


class NotificationDeadLetter(Base, TimestampMixin, TenantMixin):
    """M-02 (backend/REMEDIATION_LOG.md): a durable record of a notification the app
    tried and failed to deliver — `notif_events.emit`/`emit_many`/the broadcast fan-out
    enqueue used to just log a warning and drop it. `kind` + `payload` carry everything
    a retry needs; `app.modules.notifications.tasks.retry_dead_letters` (Celery beat,
    every 5 min) replays unresolved rows up to `MAX_RETRY_ATTEMPTS`."""

    __tablename__ = "notification_dead_letters"

    id: Mapped[uuid.UUID] = pk()
    kind: Mapped[str] = mapped_column(String(20))
    notification_type: Mapped[str] = mapped_column(String(60))
    payload: Mapped[dict] = mapped_column(JSONB)
    failure_reason: Mapped[str] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=1)
    last_attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

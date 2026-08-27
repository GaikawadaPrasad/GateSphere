"""Data-access for Notifications (FR-15). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.notifications.models import (
    Notification,
    NotificationTemplate,
    UserNotificationPreference,
)


class TemplateRepository(TenantRepository[NotificationTemplate]):
    model = NotificationTemplate

    def match(
        self, community_id: uuid.UUID, code: str, channel: str
    ) -> NotificationTemplate | None:
        return self.db.scalar(
            select(NotificationTemplate).where(
                NotificationTemplate.community_id == community_id,
                NotificationTemplate.code == code,
                NotificationTemplate.channel == channel,
            )
        )


class NotificationRepository(TenantRepository[Notification]):
    model = Notification


def preference(
    db, user_id: uuid.UUID, community_id: uuid.UUID | None, channel: str
) -> UserNotificationPreference | None:
    row = db.scalar(
        select(UserNotificationPreference).where(
            UserNotificationPreference.user_id == user_id,
            UserNotificationPreference.community_id == community_id,
            UserNotificationPreference.channel == channel,
        )
    )
    if row is None and community_id is not None:
        row = db.scalar(
            select(UserNotificationPreference).where(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.community_id.is_(None),
                UserNotificationPreference.channel == channel,
            )
        )
    return row

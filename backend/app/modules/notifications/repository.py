"""Data-access for Notifications (FR-15). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.repository import AsyncTenantRepository
from app.modules.notifications.models import (
    Notification,
    NotificationTemplate,
    UserNotificationPreference,
)


class TemplateRepository(AsyncTenantRepository[NotificationTemplate]):
    model = NotificationTemplate

    async def match(
        self, community_id: uuid.UUID, code: str, channel: str
    ) -> NotificationTemplate | None:
        return await self.db.scalar(
            select(NotificationTemplate).where(
                NotificationTemplate.community_id == community_id,
                NotificationTemplate.code == code,
                NotificationTemplate.channel == channel,
            )
        )


class NotificationRepository(AsyncTenantRepository[Notification]):
    model = Notification

    async def get(self, obj_id: uuid.UUID) -> Notification | None:
        return await self.db.scalar(
            self._scoped(select(Notification).where(Notification.id == obj_id))
            .execution_options(populate_existing=True)
            .options(selectinload(Notification.deliveries))
        )


async def preference(
    db, user_id: uuid.UUID, community_id: uuid.UUID | None, channel: str
) -> UserNotificationPreference | None:
    row = await db.scalar(
        select(UserNotificationPreference).where(
            UserNotificationPreference.user_id == user_id,
            UserNotificationPreference.community_id == community_id,
            UserNotificationPreference.channel == channel,
        )
    )
    if row is None and community_id is not None:
        row = await db.scalar(
            select(UserNotificationPreference).where(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.community_id.is_(None),
                UserNotificationPreference.channel == channel,
            )
        )
    return row

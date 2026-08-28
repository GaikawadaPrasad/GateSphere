"""Business logic for Notifications (FR-15).

- `dispatch` renders a notification for a recipient (from a template `code` or an explicit
  title/message), then fans out one `notification_delivery` per resolved channel. `in_app`
  is always delivered; other channels are **simulated** (marked delivered unless the user
  disabled the channel or is in quiet hours -> `skipped`).
- `notification_deliveries` is append-only.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.notifications import schemas
from app.modules.notifications.models import (
    Notification,
    NotificationDelivery,
    NotificationTemplate,
    UserNotificationPreference,
)
from app.modules.notifications.repository import (
    NotificationRepository,
    TemplateRepository,
    preference,
)
from app.modules.notifications.schemas import ALLOWED
from app.modules.users.models import User

_DEFAULT_CHANNELS = ("in_app",)


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


def _render(tpl: str, context: dict[str, str]) -> str:
    out = tpl
    for k, v in context.items():
        out = out.replace("{" + k + "}", str(v))
    return out


class NotificationService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.templates = TemplateRepository(db, scope)
        self.notifications = NotificationRepository(db, scope)

    def _audit(self, action, community_id, entity_type, entity_id, **kw):
        record_audit(
            self.db,
            module="notifications",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            request=self.request,
            **kw,
        )

    def _one_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    # -- templates --------------------------------------- #
    def list_templates(self, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        stmt = (
            select(NotificationTemplate)
            .where(NotificationTemplate.community_id == cid)
            .order_by(NotificationTemplate.code, NotificationTemplate.channel)
        )
        return list(self.db.scalars(stmt).all())

    def upsert_template(self, payload: schemas.TemplateUpsert, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        _enum("channel", payload.channel)
        obj = self.templates.match(cid, payload.code, payload.channel)
        data = payload.model_dump()
        if obj is None:
            obj = NotificationTemplate(community_id=cid, **data)
            self.templates.add(obj)
            action = "template.create"
        else:
            for k, v in data.items():
                setattr(obj, k, v)
            self.db.flush()
            action = "template.update"
        self._audit(action, cid, "notification_template", obj.id)
        return obj

    # -- preferences ------------------------------------ #
    def my_preferences(self):
        return list(
            self.db.scalars(
                select(UserNotificationPreference).where(
                    UserNotificationPreference.user_id == self.actor.id
                )
            ).all()
        )

    def set_preference(self, payload: schemas.PreferenceUpsert):
        _enum("channel", payload.channel)
        cid = payload.community_id
        if cid is not None:
            self.scope.require(cid)
        obj = self.db.scalar(
            select(UserNotificationPreference).where(
                UserNotificationPreference.user_id == self.actor.id,
                UserNotificationPreference.community_id == cid,
                UserNotificationPreference.channel == payload.channel,
            )
        )
        if obj is None:
            obj = UserNotificationPreference(
                user_id=self.actor.id,
                community_id=cid,
                channel=payload.channel,
            )
            self.db.add(obj)
        obj.is_enabled = payload.is_enabled
        obj.quiet_hours_start = payload.quiet_hours_start
        obj.quiet_hours_end = payload.quiet_hours_end
        self.db.flush()
        self._audit(
            "preference.set",
            cid,
            "notification_preference",
            obj.id,
            new={"channel": payload.channel, "is_enabled": payload.is_enabled},
        )
        return obj

    # -- dispatch -------------------------------------- #
    def _channel_allowed(self, user_id: uuid.UUID, cid: uuid.UUID, channel: str) -> str:
        if channel == "in_app":
            return "deliver"
        pref = preference(self.db, user_id, cid, channel)
        if pref is not None and not pref.is_enabled:
            return "disabled"
        if pref is not None and pref.quiet_hours_start and pref.quiet_hours_end:
            now_t = datetime.now(UTC).time()
            start, end = pref.quiet_hours_start, pref.quiet_hours_end
            in_quiet = start <= now_t < end if start <= end else (now_t >= start or now_t < end)
            if in_quiet:
                return "quiet"
        return "deliver"

    def dispatch(self, payload: schemas.DispatchIn) -> Notification:
        cid = self._one_community(payload.community_id)
        if self.db.get(User, payload.recipient_user_id) is None:
            raise NotFoundError("Recipient not found")
        channels = payload.channels or list(_DEFAULT_CHANNELS)
        for ch in channels:
            _enum("channel", ch)

        title, message, template_id = payload.title, payload.message, None
        if payload.template_code:
            tpl = self.templates.match(cid, payload.template_code, "in_app") or self.db.scalar(
                select(NotificationTemplate).where(
                    NotificationTemplate.community_id == cid,
                    NotificationTemplate.code == payload.template_code,
                )
            )
            if tpl is None:
                raise NotFoundError("Template not found")
            template_id = tpl.id
            title = title or _render(tpl.title_template, payload.context)
            message = message or _render(tpl.body_template, payload.context)
        if not title or not message:
            raise BusinessRuleError(
                "Provide title/message or a template_code", code="CONTENT_REQUIRED"
            )

        note = Notification(
            community_id=cid,
            recipient_user_id=payload.recipient_user_id,
            template_id=template_id,
            notification_type=payload.notification_type,
            title=title,
            message=message,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
        )
        self.notifications.add(note)

        now = datetime.now(UTC)
        for ch in channels:
            decision = self._channel_allowed(payload.recipient_user_id, cid, ch)
            if decision == "deliver":
                self.db.add(
                    NotificationDelivery(
                        notification_id=note.id,
                        channel=ch,
                        provider="in_app" if ch == "in_app" else "simulated",
                        status="delivered",
                        provider_message_id=f"sim-{secrets.token_hex(6)}",
                        sent_at=now,
                        delivered_at=now,
                    )
                )
            else:
                self.db.add(
                    NotificationDelivery(
                        notification_id=note.id,
                        channel=ch,
                        provider="simulated",
                        status="skipped",
                        failed_at=now,
                        failure_reason=f"channel {decision}",
                    )
                )
        self.db.flush()
        self._audit(
            "notification.dispatch",
            cid,
            "notification",
            note.id,
            new={"type": payload.notification_type, "channels": channels},
        )
        return note

    # -- inbox ---------------------------------------- #
    def list_mine(self, *, unread_only: bool, offset: int, limit: int):
        stmt = select(Notification).where(Notification.recipient_user_id == self.actor.id)
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc())
        return self.notifications.list(
            offset=offset, limit=limit, extra=stmt
        ), self.notifications.count(extra=stmt)

    def _mine(self, notification_id: uuid.UUID) -> Notification:
        obj = self.notifications.get(notification_id)
        if obj is None or obj.recipient_user_id != self.actor.id:
            raise NotFoundError("Notification not found")
        return obj

    def get_mine(self, notification_id: uuid.UUID) -> Notification:
        return self._mine(notification_id)

    def mark_read(self, notification_id: uuid.UUID) -> Notification:
        obj = self._mine(notification_id)
        if not obj.is_read:
            obj.is_read = True
            obj.read_at = datetime.now(UTC)
            self.db.flush()
        return obj

    def mark_all_read(self) -> int:
        rows = list(
            self.db.scalars(
                select(Notification).where(
                    Notification.recipient_user_id == self.actor.id,
                    Notification.is_read.is_(False),
                )
            ).all()
        )
        now = datetime.now(UTC)
        for r in rows:
            r.is_read = True
            r.read_at = now
        self.db.flush()
        return len(rows)

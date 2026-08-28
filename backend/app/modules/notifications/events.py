"""Domain-event -> notification fan-out (FR-15 wiring).

Other services call `emit(...)` inside their own transaction to turn a business event
(visitor approved, invoice posted, ticket resolved, ...) into a `Notification` for one
recipient. Best-effort: the dispatch runs inside a SAVEPOINT so a missing recipient /
template / any hiccup rolls back **only** the notification, never the domain operation.
"""

from __future__ import annotations

import logging
import uuid

from app.core.tenancy import TenantScope
from app.modules.notifications import schemas
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User

log = logging.getLogger(__name__)


def emit(
    db,
    scope: TenantScope,
    actor: User,
    request,
    *,
    recipient_user_id: uuid.UUID | None,
    community_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    channels: list[str] | None = None,
) -> None:
    if recipient_user_id is None or recipient_user_id == getattr(actor, "id", None):
        return  # nobody to tell, or the actor would only be notifying themselves
    payload = schemas.DispatchIn(
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        channels=channels or ["in_app"],
        community_id=community_id,
    )
    try:
        with db.begin_nested():  # SAVEPOINT — a failure here rolls back only the notification
            NotificationService(db, scope, actor, request).dispatch(payload)
    except Exception:  # notifications must never break the domain op
        log.warning("notification emit failed", extra={"type": notification_type}, exc_info=True)

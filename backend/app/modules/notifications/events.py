"""Domain-event -> notification fan-out (FR-15 wiring). Async stack (ADR-010).

Other services call `emit(...)` inside their own transaction to turn a business event
(visitor approved, invoice posted, ticket resolved, ...) into a `Notification` for one
recipient. Best-effort: the dispatch runs inside a SAVEPOINT so a missing recipient /
template / any hiccup rolls back **only** the notification, never the domain operation.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select

from app.core.tenancy import TenantScope
from app.modules.notifications import schemas
from app.modules.notifications.service import NotificationService
from app.modules.users.models import Role, User, UserRole

log = logging.getLogger(__name__)


async def emit(
    db,
    scope: TenantScope,
    actor: User | None,
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
        async with db.begin_nested():  # SAVEPOINT — rolls back only the notification
            await NotificationService(db, scope, actor, request).dispatch(payload)
    except Exception:  # notifications must never break the domain op
        log.warning("notification emit failed", extra={"type": notification_type}, exc_info=True)


async def emit_to_roles(
    db,
    scope: TenantScope,
    actor: User | None,
    request,
    *,
    community_id: uuid.UUID,
    role_slugs: list[str],
    notification_type: str,
    title: str,
    message: str,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    channels: list[str] | None = None,
) -> int:
    """Fan a single event out to every active user holding one of `role_slugs` in
    `community_id` (a global grant counts too). Returns the recipient count.
    """
    rows = (
        await db.scalars(
            select(UserRole.user_id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                Role.slug.in_(role_slugs),
                (UserRole.community_id == community_id) | (UserRole.community_id.is_(None)),
            )
        )
    ).all()
    seen: set[uuid.UUID] = set()
    for uid in rows:
        if uid in seen:
            continue
        seen.add(uid)
        await emit(
            db,
            scope,
            actor,
            request,
            recipient_user_id=uid,
            community_id=community_id,
            notification_type=notification_type,
            title=title,
            message=message,
            reference_type=reference_type,
            reference_id=reference_id,
            channels=channels,
        )
    return len(seen)

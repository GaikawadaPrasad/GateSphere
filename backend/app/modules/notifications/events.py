"""Domain-event -> notification fan-out (FR-15 wiring). Async stack (ADR-010).

Other services call `emit(...)` inside their own transaction to turn a business event
(visitor approved, invoice posted, ticket resolved, ...) into a `Notification` for one
recipient. Best-effort: the dispatch runs inside a SAVEPOINT so a missing recipient /
template / any hiccup rolls back **only** the notification, never the domain operation.

M-02 (backend/REMEDIATION_LOG.md): a failure here used to just log a warning and vanish
— unrecoverable the moment the log scrolled past. It now also writes a
`NotificationDeadLetter` row (outside the failed SAVEPOINT, so it survives and commits
with the caller's own transaction) that `app.modules.notifications.tasks.retry_dead_letters`
replays on a schedule. The write happens best-effort too (a second failure here still
must not break the domain op) — logged if even that fails.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.realtime import queue_community_event
from app.core.tenancy import TenantScope
from app.modules.notifications import schemas
from app.modules.notifications.models import NotificationDeadLetter
from app.modules.notifications.service import NotificationService
from app.modules.users.models import Role, User, UserRole

log = logging.getLogger(__name__)


async def _dead_letter(
    db: AsyncSession,
    *,
    community_id: uuid.UUID,
    kind: str,
    notification_type: str,
    payload: dict,
    reason: str,
) -> None:
    try:
        db.add(
            NotificationDeadLetter(
                community_id=community_id,
                kind=kind,
                notification_type=notification_type,
                payload=payload,
                failure_reason=reason[:2000],
                attempts=1,
                last_attempted_at=datetime.now(UTC),
            )
        )
        await db.flush()
    except Exception:  # the dead-letter write itself must never break the domain op
        log.error("dead_letter write failed", extra={"type": notification_type}, exc_info=True)


async def emit(
    db,
    scope: TenantScope,
    actor: User | None,
    ctx,
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
            await NotificationService(db, scope, actor, ctx).dispatch(payload)
    except Exception as exc:  # notifications must never break the domain op
        log.warning("notification emit failed", extra={"type": notification_type}, exc_info=True)
        await _dead_letter(
            db,
            community_id=community_id,
            kind="single",
            notification_type=notification_type,
            payload={
                "recipient_user_id": str(recipient_user_id),
                "title": title,
                "message": message,
                "reference_type": reference_type,
                "reference_id": str(reference_id) if reference_id else None,
                "channels": channels or ["in_app"],
            },
            reason=repr(exc),
        )


async def emit_many(
    db,
    *,
    recipient_user_ids: list[uuid.UUID],
    community_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
) -> int:
    """Bulk in-app notification for a broadcast (community announcement / emergency).

    One `INSERT` for the whole recipient set — no per-recipient SAVEPOINT / preference
    check / delivery row, so it stays O(1) queries for a community of any size. SMS / email
    fan-out for very large communities should move to Celery; in-app is the durable record.
    Best-effort: a failure here never rolls back the publish.
    """
    from app.modules.notifications.models import Notification

    ids = list(dict.fromkeys(u for u in recipient_user_ids if u is not None))
    if not ids:
        return 0
    try:
        async with db.begin_nested():
            db.add_all(
                Notification(
                    community_id=community_id,
                    recipient_user_id=uid,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    reference_type=reference_type,
                    reference_id=reference_id,
                )
                for uid in ids
            )
        # One community-wide hint for the whole broadcast, not one per recipient.
        queue_community_event(
            db,
            community_id=community_id,
            module="notifications",
            entity_type="notification",
            action="notification.broadcast",
            actor_id=None,
        )
    except Exception as exc:
        log.warning("broadcast emit failed", extra={"type": notification_type}, exc_info=True)
        await _dead_letter(
            db,
            community_id=community_id,
            kind="bulk",
            notification_type=notification_type,
            payload={
                "recipient_user_ids": [str(u) for u in ids],
                "title": title,
                "message": message,
                "reference_type": reference_type,
                "reference_id": str(reference_id) if reference_id else None,
            },
            reason=repr(exc),
        )
        return 0
    return len(ids)


async def emit_to_roles(
    db,
    scope: TenantScope,
    actor: User | None,
    ctx,
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
            ctx,
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

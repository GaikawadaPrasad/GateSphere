"""Celery tasks for Notification Engine (async/scheduled work).

`retry_dead_letters` (M-02, backend/REMEDIATION_LOG.md) replays
`NotificationDeadLetter` rows written by `app.modules.notifications.events` (a
single/bulk dispatch that failed) and `app.modules.communication.service` (a broadcast
fan-out enqueue that failed) — previously those failures were only logged and then
unrecoverable. Runs on a schedule (`app.core.celery_app` beat), not per-request, since a
retry is best-effort background work, not something the original caller should block on.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery
from app.core.jobs import job_session, run, system_actor, system_scope
from app.core.tenancy import TenantScope
from app.modules.notifications import schemas
from app.modules.notifications.models import Notification, NotificationDeadLetter
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User

log = structlog.get_logger(__name__)

MAX_RETRY_ATTEMPTS = 10


async def _retry_one(
    db: AsyncSession, row: NotificationDeadLetter, actor: User, scope: TenantScope
) -> bool:
    """Returns True if the dead letter is now resolved."""
    if row.kind == "single":
        p = row.payload
        await NotificationService(db, scope, actor, None).dispatch(
            schemas.DispatchIn(
                recipient_user_id=uuid.UUID(p["recipient_user_id"]),
                notification_type=row.notification_type,
                title=p.get("title"),
                message=p.get("message"),
                reference_type=p.get("reference_type"),
                reference_id=uuid.UUID(p["reference_id"]) if p.get("reference_id") else None,
                channels=p.get("channels") or ["in_app"],
                community_id=row.community_id,
            )
        )
        return True

    if row.kind == "bulk":
        p = row.payload
        ids = [uuid.UUID(u) for u in p.get("recipient_user_ids", [])]
        if not ids:
            return True  # nothing left to deliver — treat as resolved
        db.add_all(
            Notification(
                community_id=row.community_id,
                recipient_user_id=uid,
                notification_type=row.notification_type,
                title=p.get("title"),
                message=p.get("message"),
                reference_type=p.get("reference_type"),
                reference_id=uuid.UUID(p["reference_id"]) if p.get("reference_id") else None,
            )
            for uid in ids
        )
        await db.flush()
        return True

    if row.kind == "broadcast_enqueue":
        from app.modules.communication.tasks import fan_out_announcement

        fan_out_announcement.apply_async(
            args=[row.payload["announcement_id"]], countdown=2, queue="notifications"
        )
        return True

    log.error("dead_letter unknown kind", kind=row.kind, id=str(row.id))
    return False


async def _retry_dead_letters() -> dict:
    retried, resolved, still_failing = 0, 0, 0
    async with job_session() as db:
        actor = await system_actor(db)
        if actor is None:
            log.error("notifications.retry_dead_letters.no_system_actor")
            return {"retried": 0, "resolved": 0, "still_failing": 0}
        scope = system_scope(actor)
        rows = (
            await db.scalars(
                select(NotificationDeadLetter)
                .where(
                    NotificationDeadLetter.resolved_at.is_(None),
                    NotificationDeadLetter.attempts < MAX_RETRY_ATTEMPTS,
                )
                .order_by(NotificationDeadLetter.created_at)
                .limit(200)
            )
        ).all()
        for row in rows:
            retried += 1
            try:
                async with db.begin_nested():
                    ok = await _retry_one(db, row, actor, scope)
                if ok:
                    row.resolved_at = datetime.now(UTC)
                    resolved += 1
                else:
                    row.attempts += 1
                    row.last_attempted_at = datetime.now(UTC)
                    still_failing += 1
            except Exception as exc:
                row.attempts += 1
                row.last_attempted_at = datetime.now(UTC)
                row.failure_reason = repr(exc)[:2000]
                still_failing += 1
                log.warning(
                    "dead_letter retry failed",
                    id=str(row.id),
                    kind=row.kind,
                    attempts=row.attempts,
                    exc_info=True,
                )
    log.info(
        "notifications.retry_dead_letters",
        retried=retried,
        resolved=resolved,
        still_failing=still_failing,
    )
    return {"retried": retried, "resolved": resolved, "still_failing": still_failing}


@celery.task(name="app.modules.notifications.tasks.retry_dead_letters")
def retry_dead_letters() -> dict:
    return run(_retry_dead_letters())

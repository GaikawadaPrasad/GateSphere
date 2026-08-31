"""Celery tasks for Community Communication (FR-12 / FR-15).

`fan_out_announcement` resolves a published announcement's targets to resident user ids and
creates the in-app notifications — off the request path so a whole-community broadcast
cannot slow the `POST /publish` call (NFR-PERF). Runs on the `notifications` queue.

**Idempotent**: skips if the announcement is not (yet) published, or if notifications for it
already exist. Safe to retry / double-fire.
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.celery_app import celery
from app.core.jobs import job_session, run, system_actor, system_scope
from app.modules.communication.models import Announcement
from app.modules.communication.service import CommunicationService
from app.modules.notifications import events as notif_events
from app.modules.notifications.models import Notification

log = structlog.get_logger(__name__)

_MAX_ATTEMPTS = 3


async def _fan_out_announcement(announcement_id: str, attempt: int) -> dict:
    aid = uuid.UUID(announcement_id)
    async with job_session() as db:
        ann = await db.scalar(
            select(Announcement)
            .options(selectinload(Announcement.targets))
            .where(Announcement.id == aid)
        )
        if ann is None:
            return {"status": "not_found"}
        if not ann.is_published:
            return {"status": "not_published", "retry": attempt < _MAX_ATTEMPTS}
        already = await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.reference_id == aid, Notification.reference_type == "announcement")
        )
        if already:
            return {"status": "already_sent", "notifications": already}

        actor = await system_actor(db)
        scope = system_scope(actor)
        svc = CommunicationService(db, scope, actor, None)
        recipients = await svc._announcement_recipients(ann)
        n = await notif_events.emit_many(
            db,
            recipient_user_ids=recipients,
            community_id=ann.community_id,
            notification_type=f"communication.{ann.announcement_type}",
            title=ann.title,
            message=(ann.body or "")[:2000],
            reference_type="announcement",
            reference_id=ann.id,
        )
        if ann.announcement_type == "emergency":
            await notif_events.emit_to_roles(
                db,
                scope,
                actor,
                None,
                community_id=ann.community_id,
                role_slugs=["security_supervisor", "security_guard", "facility_manager"],
                notification_type="communication.emergency",
                title=f"EMERGENCY: {ann.title}",
                message=(ann.body or "")[:2000],
                reference_type="announcement",
                reference_id=ann.id,
                channels=["in_app", "sms"],
            )
    log.info("communication.fan_out", announcement=str(aid), recipients=n)
    return {"status": "sent", "notifications": n}


@celery.task(
    name="app.modules.communication.tasks.fan_out_announcement",
    bind=True,
    max_retries=_MAX_ATTEMPTS,
)
def fan_out_announcement(self, announcement_id: str) -> dict:  # type: ignore[no-untyped-def]
    result = run(_fan_out_announcement(announcement_id, self.request.retries))
    if result.get("retry"):
        raise self.retry(countdown=5)
    return result

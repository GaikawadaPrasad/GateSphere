"""Celery tasks for Visitor Management (FR-04).

`expire_stale_requests` closes the loop on pre-approvals that were never used:
a `pending` or `approved` request whose `valid_until` has passed moves to
`expired` (a terminal state) so it can no longer admit a visitor at the gate.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import select

from app.core.celery_app import celery
from app.core.jobs import job_session, system_actor, system_scope
from app.modules.audit.service import record_audit
from app.modules.notifications import events as notif_events
from app.modules.visitors.models import VisitorRequest

log = structlog.get_logger(__name__)


@celery.task(name="app.modules.visitors.tasks.expire_stale_requests")
def expire_stale_requests() -> dict:
    now = datetime.now(UTC)
    expired = 0
    with job_session() as db:
        actor = system_actor(db)
        scope = system_scope(actor)
        rows = db.scalars(
            select(VisitorRequest).where(
                VisitorRequest.status.in_(("pending", "approved")),
                VisitorRequest.valid_until.is_not(None),
                VisitorRequest.valid_until < now,
            )
        ).all()
        for req in rows:
            req.status = "expired"
            db.flush()
            record_audit(
                db,
                module="visitors",
                action="request.expired",
                actor=actor,
                community_id=req.community_id,
                entity_type="visitor_request",
                entity_id=req.id,
                old={"status": "approved"},
                new={"status": "expired"},
            )
            if req.host_user_id:
                notif_events.emit(
                    db,
                    scope,
                    actor,
                    None,
                    recipient_user_id=req.host_user_id,
                    community_id=req.community_id,
                    notification_type="visitors.request_expired",
                    title="Visitor pre-approval expired",
                    message="A visitor pre-approval you created has expired unused.",
                    reference_type="visitor_request",
                    reference_id=req.id,
                )
            expired += 1
    log.info("visitors.expire_requests", expired=expired)
    return {"expired": expired}

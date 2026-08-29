"""Celery tasks for Amenity Booking (FR-11). Async job bodies (ADR-010).

`close_past_bookings` marks a `confirmed` booking `completed` once its window has
ended, so slot-availability maths and the resident's active-booking count stop
counting it. Mirrors `AmenityService.mark_booking` (confirmed -> completed only).
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import select

from app.core.celery_app import celery
from app.core.jobs import job_session, run, system_actor
from app.modules.amenities.models import AmenityBooking
from app.modules.audit.service import record_audit_async

log = structlog.get_logger(__name__)


async def _close_past_bookings() -> dict:
    now = datetime.now(UTC)
    closed = 0
    async with job_session() as db:
        actor = await system_actor(db)
        rows = (
            await db.scalars(
                select(AmenityBooking).where(
                    AmenityBooking.status == "confirmed",
                    AmenityBooking.end_at < now,
                )
            )
        ).all()
        for b in rows:
            b.status = "completed"
            await db.flush()
            await record_audit_async(
                db,
                module="amenities",
                action="booking.completed",
                actor=actor,
                community_id=b.community_id,
                entity_type="amenity_booking",
                entity_id=b.id,
                old={"status": "confirmed"},
                new={"status": "completed"},
            )
            closed += 1
    log.info("amenities.close_bookings", closed=closed)
    return {"closed": closed}


@celery.task(name="app.modules.amenities.tasks.close_past_bookings")
def close_past_bookings() -> dict:
    return run(_close_past_bookings())

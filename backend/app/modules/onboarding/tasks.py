"""Celery tasks for tenant onboarding (invitation email, invitation expiry sweep).

`send_invitation_email` delivers the Secure Onboarding Invitation URL to the invited
resident's email address — off the request path (email is a real, potentially-slow/failing
external call; see `app.services.email`), on the `email` queue so it can never be delayed by
a bulk notification fan-out (AGENTS.md §9.3).

The invitation's plaintext token is never persisted (only `token_hash` is) and so cannot be
re-derived from the DB — the caller (`OnboardingService.create_invitation` /
`regenerate_invitation`, which mint the token) passes the already-built `accept_url` straight
through as a task argument; the task never needs to query for the token itself.

**Idempotent**: stamps `email_sent_at` once the send actually succeeds, so a retried task
never re-sends (GS-BUG-006 — invitation emails were previously never sent at all: the token/
URL was generated and stored, but nothing ever called `app.services.email.send_email`).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select

from app.core.celery_app import celery
from app.core.errors import ServiceUnavailableError
from app.core.jobs import job_session, run
from app.modules.onboarding.models import CommunityInvitation
from app.services.email import send_email

log = structlog.get_logger(__name__)

_MAX_ATTEMPTS = 3


async def _send_invitation_email(invitation_id: str, accept_url: str, attempt: int) -> dict:
    inv_id = uuid.UUID(invitation_id)
    async with job_session() as db:
        inv = await db.scalar(select(CommunityInvitation).where(CommunityInvitation.id == inv_id))
        if inv is None:
            return {"status": "not_found"}
        if inv.email_sent_at is not None:
            return {"status": "already_sent"}
        if inv.status != "pending":
            # Revoked/accepted/expired before the send fired — nothing to deliver.
            return {"status": "skipped", "invitation_status": inv.status}

        greeting = f"Hi {inv.full_name}," if inv.full_name else "Hi,"
        note = f"<p>{inv.message}</p>" if inv.message else ""
        html = (
            f"<p>{greeting}</p>"
            "<p>You've been invited to join your community on GateSphere.</p>"
            f"{note}"
            f'<p><a href="{accept_url}">Accept your invitation</a></p>'
            f"<p>This link expires on {inv.expires_at:%d %b %Y}.</p>"
        )
        try:
            send_email(
                inv.invited_email,
                "Your GateSphere community invitation",
                html,
                to_name=inv.full_name,
            )
        except ServiceUnavailableError:
            # The only exception `send_email` raises — a transient provider failure after its
            # own internal retries are exhausted. A narrow catch, not a blanket one
            # (AGENTS.md §9.3): anything else (bad recipient, config error) should surface.
            log.warning(
                "onboarding.invitation_email.failed", invitation=str(inv_id), attempt=attempt
            )
            return {"status": "failed", "retry": attempt < _MAX_ATTEMPTS}

        inv.email_sent_at = datetime.now(UTC)
    log.info("onboarding.invitation_email.sent", invitation=str(inv_id))
    return {"status": "sent"}


@celery.task(
    name="app.modules.onboarding.tasks.send_invitation_email",
    bind=True,
    max_retries=_MAX_ATTEMPTS,
)
def send_invitation_email(self, invitation_id: str, accept_url: str) -> dict:  # type: ignore[no-untyped-def]
    result = run(_send_invitation_email(invitation_id, accept_url, self.request.retries))
    if result.get("retry"):
        raise self.retry(countdown=5)
    return result

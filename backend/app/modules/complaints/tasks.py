"""Celery tasks for Complaint & Service Desk (FR-10).

`sweep_ticket_sla` is the escalation engine: it walks every open ticket, and when
an SLA milestone passes it advances the ticket's `escalation_state`
(`on_track -> at_risk -> breached -> escalated`), stamps the matching timestamp,
writes an audit row and notifies the resident + the configured escalation role.
Idempotent — a ticket is only touched (and only notified) when its state changes.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from sqlalchemy import select

from app.core.celery_app import celery
from app.core.jobs import job_session, system_actor, system_scope
from app.modules.audit.service import record_audit
from app.modules.complaints.models import ServiceTicket, SlaPolicy
from app.modules.notifications import events as notif_events

log = structlog.get_logger(__name__)

_OPEN_STATES = ("created", "assigned", "acknowledged", "in_progress", "reopened")
_ORDER = {"on_track": 0, "at_risk": 1, "breached": 2, "escalated": 3}


def _target_state(t: ServiceTicket, sla: SlaPolicy | None, now: datetime) -> str:
    state = "on_track"
    if t.escalation_due_at and now >= t.escalation_due_at:
        state = "escalated"
    elif t.resolution_due_at and now >= t.resolution_due_at:
        state = "breached"
    elif t.resolution_due_at and t.created_at:
        pct = (sla.at_risk_threshold_percent if sla else 80) / 100
        window = (t.resolution_due_at - t.created_at).total_seconds()
        at_risk_at = t.created_at.timestamp() + window * pct
        if now.timestamp() >= at_risk_at:
            state = "at_risk"
    return state


@celery.task(name="app.modules.complaints.tasks.sweep_ticket_sla")
def sweep_ticket_sla() -> dict:
    now = datetime.now(UTC)
    changed = 0
    with job_session() as db:
        actor = system_actor(db)
        scope = system_scope(actor)
        slas = {s.id: s for s in db.scalars(select(SlaPolicy)).all()}
        tickets = db.scalars(
            select(ServiceTicket).where(ServiceTicket.status.in_(_OPEN_STATES))
        ).all()
        for t in tickets:
            sla = slas.get(t.sla_policy_id) if t.sla_policy_id else None
            target = _target_state(t, sla, now)
            if _ORDER[target] <= _ORDER[t.escalation_state]:
                continue

            t.escalation_state = target
            if target == "at_risk":
                t.sla_at_risk_at = now
            elif target == "breached":
                t.sla_breached_at = t.sla_breached_at or now
            elif target == "escalated":
                t.escalated_at = now
                t.escalation_level = (t.escalation_level or 0) + 1
            db.flush()

            record_audit(
                db,
                module="complaints",
                action=f"ticket.sla_{target}",
                actor=actor,
                community_id=t.community_id,
                entity_type="service_ticket",
                entity_id=t.id,
                new={"escalation_state": target, "escalation_level": t.escalation_level},
            )
            role = sla.escalation_notify_role if sla else "facility_manager"
            verb = {
                "at_risk": "is nearing its SLA",
                "breached": "has BREACHED its SLA",
                "escalated": "has been ESCALATED",
            }[target]
            notif_events.emit_to_roles(
                db,
                scope,
                actor,
                None,
                community_id=t.community_id,
                role_slugs=[role, "security_supervisor"] if target == "escalated" else [role],
                notification_type=f"complaints.ticket_{target}",
                title=f"Ticket {t.ticket_number} {verb}",
                message=f"'{t.subject}' ({t.priority}) {verb}. Please action.",
                reference_type="service_ticket",
                reference_id=t.id,
                channels=["in_app", "email"] if target != "at_risk" else ["in_app"],
            )
            if t.raised_by_user_id:
                notif_events.emit(
                    db,
                    scope,
                    actor,
                    None,
                    recipient_user_id=t.raised_by_user_id,
                    community_id=t.community_id,
                    notification_type=f"complaints.ticket_{target}",
                    title=f"Update on ticket {t.ticket_number}",
                    message=f"Your ticket '{t.subject}' {verb}. The team has been alerted.",
                    reference_type="service_ticket",
                    reference_id=t.id,
                )
            changed += 1
    log.info("sla.sweep", tickets_changed=changed)
    return {"tickets_changed": changed}

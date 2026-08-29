"""Celery tasks for Maintenance & Billing (FR-09). Async job bodies (ADR-010).

- `sweep_overdue_invoices` — posted/partially-paid invoices past their due date
  move to `overdue` and the resident is notified.
- `send_dues_reminders` — recurring nudge for every invoice still carrying a
  balance (FR-15 "recurring maintenance-dues reminder", not just on-post).
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import structlog
from sqlalchemy import select

from app.core.celery_app import celery
from app.core.jobs import job_session, run, system_actor, system_scope
from app.modules.audit.service import record_audit_async
from app.modules.billing.models import MaintenanceInvoice
from app.modules.notifications import events as notif_events

log = structlog.get_logger(__name__)

_WITH_BALANCE = ("posted", "partially_paid", "overdue")


async def _sweep_overdue_invoices() -> dict:
    today = date.today()
    moved = 0
    async with job_session() as db:
        actor = await system_actor(db)
        scope = system_scope(actor)
        rows = (
            await db.scalars(
                select(MaintenanceInvoice).where(
                    MaintenanceInvoice.status.in_(("posted", "partially_paid")),
                    MaintenanceInvoice.due_date.is_not(None),
                    MaintenanceInvoice.due_date < today,
                    MaintenanceInvoice.balance_due > 0,
                )
            )
        ).all()
        for inv in rows:
            inv.status = "overdue"
            await db.flush()
            await record_audit_async(
                db,
                module="billing",
                action="invoice.overdue",
                actor=actor,
                community_id=inv.community_id,
                entity_type="maintenance_invoice",
                entity_id=inv.id,
                new={"status": "overdue", "balance_due": inv.balance_due},
            )
            if inv.billed_to_user_id:
                await notif_events.emit(
                    db,
                    scope,
                    actor,
                    None,
                    recipient_user_id=inv.billed_to_user_id,
                    community_id=inv.community_id,
                    notification_type="billing.invoice_overdue",
                    title=f"Invoice {inv.invoice_number} is overdue",
                    message=(
                        f"{inv.invoice_number} of {inv.balance_due} was due on "
                        f"{inv.due_date}. Please clear the balance."
                    ),
                    reference_type="maintenance_invoice",
                    reference_id=inv.id,
                    channels=["in_app", "email", "sms"],
                )
            moved += 1
    log.info("billing.overdue_sweep", invoices_marked=moved)
    return {"invoices_marked": moved}


async def _send_dues_reminders() -> dict:
    now = datetime.now(UTC)
    sent = 0
    async with job_session() as db:
        actor = await system_actor(db)
        scope = system_scope(actor)
        rows = (
            await db.scalars(
                select(MaintenanceInvoice).where(
                    MaintenanceInvoice.status.in_(_WITH_BALANCE),
                    MaintenanceInvoice.balance_due > 0,
                    MaintenanceInvoice.billed_to_user_id.is_not(None),
                )
            )
        ).all()
        for inv in rows:
            await notif_events.emit(
                db,
                scope,
                actor,
                None,
                recipient_user_id=inv.billed_to_user_id,
                community_id=inv.community_id,
                notification_type="billing.dues_reminder",
                title=f"Reminder: {inv.invoice_number} balance due",
                message=(
                    f"A balance of {inv.balance_due} is outstanding on "
                    f"{inv.invoice_number}. Pay via the resident portal."
                ),
                reference_type="maintenance_invoice",
                reference_id=inv.id,
                channels=["in_app", "email"],
            )
            sent += 1
    log.info("billing.dues_reminders", reminders_sent=sent, at=now.isoformat())
    return {"reminders_sent": sent}


@celery.task(name="app.modules.billing.tasks.sweep_overdue_invoices")
def sweep_overdue_invoices() -> dict:
    return run(_sweep_overdue_invoices())


@celery.task(name="app.modules.billing.tasks.send_dues_reminders")
def send_dues_reminders() -> dict:
    return run(_send_dues_reminders())

"""Celery tasks for Maintenance & Billing (FR-09). Async job bodies (ADR-010).

- `sweep_overdue_invoices` — posted/partially-paid invoices past their due date
  move to `overdue` and the resident is notified.
- `send_dues_reminders` — recurring nudge for every invoice still carrying a
  balance (FR-15 "recurring maintenance-dues reminder", not just on-post).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal

import structlog
from sqlalchemy import select

from app.core.celery_app import celery
from app.core.jobs import job_session, run, system_actor, system_scope
from app.modules.audit.service import record_audit_async
from app.modules.billing.models import (
    BillingRule,
    ChargeHead,
    InvoiceItem,
    LedgerEntry,
    MaintenanceInvoice,
)
from app.modules.communities.models import Community, Unit
from app.modules.notifications import events as notif_events
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from sqlalchemy import func

log = structlog.get_logger(__name__)

_WITH_BALANCE = ("posted", "partially_paid", "overdue")
_Q = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(_Q)


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
            rule = await db.scalar(
                select(BillingRule).where(BillingRule.community_id == inv.community_id)
            )
            late_fee_add = Decimal("0.00")
            if rule and rule.late_fee_value > Decimal("0"):
                if rule.late_fee_mode == "flat":
                    late_fee_add = _money(rule.late_fee_value)
                elif rule.late_fee_mode == "percentage":
                    late_fee_add = _money(inv.balance_due * rule.late_fee_value / Decimal("100"))

            inv.status = "overdue"
            if late_fee_add > Decimal("0"):
                inv.late_fee = _money(inv.late_fee + late_fee_add)
                inv.total_amount = _money(inv.subtotal - inv.discount + inv.tax + inv.late_fee)
                inv.balance_due = _money(inv.total_amount - inv.amount_paid)

            await db.flush()
            await record_audit_async(
                db,
                module="billing",
                action="invoice.overdue",
                actor=actor,
                community_id=inv.community_id,
                entity_type="maintenance_invoice",
                entity_id=inv.id,
                new={"status": "overdue", "balance_due": inv.balance_due, "late_fee": inv.late_fee},
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
                    channels=["in_app", "email", "sms", "whatsapp", "push"],
                )
            moved += 1
    log.info("billing.overdue_sweep", invoices_marked=moved)
    return {"invoices_marked": moved}


async def _generate_monthly_invoices() -> dict:
    import calendar

    today = date.today()
    period_start = today.replace(day=1)
    _, last_day = calendar.monthrange(today.year, today.month)
    period_end = today.replace(day=last_day)
    generated = 0

    async with job_session() as db:
        actor = await system_actor(db)
        communities = (await db.scalars(select(Community).where(Community.is_active.is_(True)))).all()
        for comm in communities:
            rule = await db.scalar(select(BillingRule).where(BillingRule.community_id == comm.id))
            due_day = rule.due_day if rule else 10
            due_date = today.replace(day=min(due_day, last_day))

            charge_heads = list(
                (
                    await db.scalars(
                        select(ChargeHead).where(
                            ChargeHead.community_id == comm.id, ChargeHead.is_active.is_(True)
                        )
                    )
                ).all()
            )
            if not charge_heads:
                continue

            units = list((await db.scalars(select(Unit).where(Unit.community_id == comm.id))).all())
            for unit in units:
                existing = await db.scalar(
                    select(MaintenanceInvoice.id).where(
                        MaintenanceInvoice.community_id == comm.id,
                        MaintenanceInvoice.unit_id == unit.id,
                        MaintenanceInvoice.billing_period_start == period_start,
                        MaintenanceInvoice.status != "cancelled",
                    )
                )
                if existing:
                    continue

                occ = await db.scalar(
                    select(UnitOccupancy).where(
                        UnitOccupancy.unit_id == unit.id,
                        UnitOccupancy.is_primary.is_(True),
                        UnitOccupancy.is_active.is_(True),
                    )
                )
                billed_user_id = None
                if occ:
                    prof = await db.get(ResidentProfile, occ.resident_profile_id)
                    if prof:
                        billed_user_id = prof.user_id

                seq_val = (
                    await db.scalar(
                        select(func.count(MaintenanceInvoice.id)).where(
                            MaintenanceInvoice.community_id == comm.id
                        )
                    )
                    or 0
                ) + 1
                inv_number = f"INV-{today.year}{today.month:02d}-{seq_val:05d}"

                subtotal = Decimal("0")
                taxable_base = Decimal("0")
                items = []
                for ch in charge_heads:
                    if ch.calculation_type == "per_sqft" and getattr(unit, "area_sqft", None):
                        qty = Decimal(str(unit.area_sqft))
                    else:
                        qty = Decimal("1")
                    rate = ch.default_amount
                    amt = _money(qty * rate)
                    subtotal += amt
                    if ch.taxable:
                        taxable_base += amt
                    items.append(
                        InvoiceItem(
                            charge_head_id=ch.id,
                            description=ch.name,
                            quantity=qty,
                            unit_rate=_money(rate),
                            amount=amt,
                            taxable=ch.taxable,
                        )
                    )

                tax_pct = rule.tax_percent if rule else Decimal("0")
                tax = _money(taxable_base * tax_pct / Decimal("100"))
                total_amt = _money(subtotal + tax)

                inv = MaintenanceInvoice(
                    community_id=comm.id,
                    unit_id=unit.id,
                    billed_to_user_id=billed_user_id,
                    invoice_number=inv_number,
                    billing_period_start=period_start,
                    billing_period_end=period_end,
                    issue_date=today,
                    due_date=due_date,
                    subtotal=_money(subtotal),
                    tax=tax,
                    total_amount=total_amt,
                    amount_paid=Decimal("0.00"),
                    balance_due=total_amt,
                    status="posted",
                    items=items,
                )
                db.add(inv)
                await db.flush()

                prev = await db.scalar(
                    select(LedgerEntry)
                    .where(LedgerEntry.unit_id == unit.id)
                    .order_by(LedgerEntry.entry_seq.desc())
                    .limit(1)
                )
                prev_bal = Decimal(prev.balance_after) if prev else Decimal("0")
                db.add(
                    LedgerEntry(
                        community_id=comm.id,
                        unit_id=unit.id,
                        user_id=billed_user_id,
                        entry_type="debit",
                        source_type="invoice",
                        source_id=inv.id,
                        amount=total_amt,
                        balance_after=_money(prev_bal + total_amt),
                        narration=f"Monthly Maintenance Invoice {inv_number} posted",
                    )
                )
                generated += 1

    log.info("billing.monthly_invoices_generated", generated=generated)
    return {"invoices_generated": generated}


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
                channels=["in_app", "email", "sms", "whatsapp", "push"],
            )
            sent += 1
    log.info("billing.dues_reminders", reminders_sent=sent, at=now.isoformat())
    return {"reminders_sent": sent}


@celery.task(name="app.modules.billing.tasks.sweep_overdue_invoices")
def sweep_overdue_invoices() -> dict:
    return run(_sweep_overdue_invoices())


@celery.task(name="app.modules.billing.tasks.generate_monthly_invoices")
def generate_monthly_invoices() -> dict:
    return run(_generate_monthly_invoices())


@celery.task(name="app.modules.billing.tasks.send_dues_reminders")
def send_dues_reminders() -> dict:
    return run(_send_dues_reminders())


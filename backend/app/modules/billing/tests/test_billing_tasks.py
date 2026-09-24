"""FR-09 — scheduled billing jobs (`app.modules.billing.tasks`).

Regression for re-audit #3 N-1: `sweep_overdue_invoices` called `record_audit_async`
without importing it, so the first overdue invoice raised `NameError`, the job rolled
back, and no invoice was ever marked overdue or charged a late fee.

The sweep is global (every past-due invoice in the DB), so the test snapshots every row
it can touch and restores them in `finally` — no residue for later tests.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.modules.audit.models import AuditLog
from app.modules.billing.models import BillingRule, MaintenanceInvoice
from app.modules.billing.tasks import sweep_overdue_invoices

_RESTORED_COLS = ("status", "due_date", "late_fee", "total_amount", "balance_due")


def _sweepable(db: Session) -> Select[tuple[MaintenanceInvoice]]:
    return select(MaintenanceInvoice).where(
        MaintenanceInvoice.status.in_(("posted", "partially_paid")),
        MaintenanceInvoice.balance_due > 0,
    )


def test_overdue_sweep_marks_invoice_applies_late_fee_and_audits(seed_ids: dict[str, str]) -> None:
    cid = seed_ids["community_id"]
    with SessionLocal() as db:
        target = db.scalar(_sweepable(db).where(MaintenanceInvoice.community_id == cid).limit(1))
        assert target is not None, "seed must contain a posted invoice with a balance"
        target_id = target.id
        # Snapshot everything the global sweep could mutate.
        snapshot = {
            inv.id: {c: getattr(inv, c) for c in _RESTORED_COLS}
            for inv in db.scalars(_sweepable(db)).all()
        }
        rule = db.scalar(select(BillingRule).where(BillingRule.community_id == cid))
        assert rule is not None
        rule_snapshot = (rule.late_fee_mode, rule.late_fee_value)
        rule.late_fee_mode, rule.late_fee_value = "flat", Decimal("150.00")
        target.due_date = date.today() - timedelta(days=3)
        before_late_fee = Decimal(target.late_fee)
        before_balance = Decimal(target.balance_due)
        db.commit()

    try:
        out = sweep_overdue_invoices()
        assert out["invoices_marked"] >= 1

        with SessionLocal() as db:
            inv = db.get(MaintenanceInvoice, target_id)
            assert inv is not None
            assert inv.status == "overdue"
            assert inv.late_fee == before_late_fee + Decimal("150.00")
            assert inv.balance_due == before_balance + Decimal("150.00")
            audit = db.scalar(
                select(AuditLog).where(
                    AuditLog.entity_id == str(target_id),
                    AuditLog.action == "invoice.overdue",
                )
            )
            assert audit is not None, "overdue transition must be audited (AGENTS.md §10)"
            assert audit.community_id == inv.community_id
            assert audit.new_values is not None and audit.new_values["status"] == "overdue"

        # Idempotent by stamping: an already-overdue invoice is not charged again.
        sweep_overdue_invoices()
        with SessionLocal() as db:
            again = db.get(MaintenanceInvoice, target_id)
            assert again is not None
            assert again.late_fee == before_late_fee + Decimal("150.00")
    finally:
        with SessionLocal() as db:
            for inv_id, cols in snapshot.items():
                restored = db.get(MaintenanceInvoice, inv_id)
                assert restored is not None
                for col, value in cols.items():
                    setattr(restored, col, value)
            rule = db.scalar(select(BillingRule).where(BillingRule.community_id == cid))
            assert rule is not None
            rule.late_fee_mode, rule.late_fee_value = rule_snapshot
            db.commit()

"""Unit tests — BillingService: invoice totals, posting, payment allocation, ledger."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.core.errors import BusinessRuleError
from app.modules.billing import schemas
from app.modules.billing.service import BillingService


def _svc(db, scope, actor):
    return BillingService(db, scope, actor)


def _invoice(svc, unit, **kw):
    payload = schemas.InvoiceCreate(
        unit_id=unit.id,
        items=[
            schemas.InvoiceLineCreate(description="Maintenance", quantity=1, unit_rate="1000.00"),
            schemas.InvoiceLineCreate(
                description="Sinking Fund", quantity=1, unit_rate="500.00", taxable=True
            ),
        ],
        **kw,
    )
    return svc.create_invoice(payload)


def test_invoice_totals_with_tax(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    svc.update_rule(schemas.RuleUpdate(tax_percent="10"), community_id=community.id)
    inv = _invoice(svc, unit)
    assert inv.subtotal == Decimal("1500.00")
    assert inv.tax == Decimal("50.00")  # 10% of the 500 taxable line
    assert inv.total_amount == Decimal("1550.00")
    assert inv.balance_due == Decimal("1550.00")
    assert inv.status == "draft"


def test_post_then_pay_updates_status_and_ledger(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    svc.update_rule(schemas.RuleUpdate(tax_percent="0"), community_id=community.id)
    inv = _invoice(svc, unit)
    svc.post_invoice(inv.id)
    assert inv.status == "posted"

    # partial payment
    pay1 = svc.record_payment(
        schemas.PaymentCreate(
            amount="1000.00",
            allocations=[schemas.PaymentAllocationIn(invoice_id=inv.id, amount="1000.00")],
            community_id=community.id,
        )
    )
    db.refresh(inv)
    assert inv.status == "partially_paid" and inv.balance_due == Decimal("500.00")

    # settle the rest
    svc.record_payment(
        schemas.PaymentCreate(
            amount="500.00",
            allocations=[schemas.PaymentAllocationIn(invoice_id=inv.id, amount="500.00")],
            community_id=community.id,
        )
    )
    db.refresh(inv)
    assert inv.status == "paid" and inv.balance_due == Decimal("0.00")

    rows, _ = svc.unit_ledger(unit.id, offset=0, limit=20)
    assert rows[0].balance_after == Decimal("0.00")  # newest first
    assert pay1.payment_reference.startswith("PAY-")


def test_over_allocation_rejected(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inv = _invoice(svc, unit)
    svc.post_invoice(inv.id)
    with pytest.raises(BusinessRuleError) as exc:
        svc.record_payment(
            schemas.PaymentCreate(
                amount="99999.00",
                allocations=[schemas.PaymentAllocationIn(invoice_id=inv.id, amount="99999.00")],
                community_id=community.id,
            )
        )
    assert exc.value.code == "OVER_ALLOCATION"


def test_allocation_sum_must_match(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inv = _invoice(svc, unit)
    svc.post_invoice(inv.id)
    with pytest.raises(BusinessRuleError) as exc:
        svc.record_payment(
            schemas.PaymentCreate(
                amount="100.00",
                allocations=[schemas.PaymentAllocationIn(invoice_id=inv.id, amount="50.00")],
                community_id=community.id,
            )
        )
    assert exc.value.code == "ALLOCATION_MISMATCH"


def test_cannot_cancel_invoice_with_payments(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inv = _invoice(svc, unit)
    svc.post_invoice(inv.id)
    svc.record_payment(
        schemas.PaymentCreate(
            amount="100.00",
            allocations=[schemas.PaymentAllocationIn(invoice_id=inv.id, amount="100.00")],
            community_id=community.id,
        )
    )
    with pytest.raises(BusinessRuleError) as exc:
        svc.cancel_invoice(inv.id)
    assert exc.value.code == "INVOICE_HAS_PAYMENTS"

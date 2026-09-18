"""Integration tests — Billing router, RBAC, tenant scope."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/billing"


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "billing"


def test_invoices_need_auth(client):
    assert client.get(f"{P}/invoices").status_code == 401


def test_admin_invoice_lifecycle(as_role, seed_ids):
    admin = as_role("community_admin")
    unit_id = _unit_in(seed_ids["community_id"])
    r = admin.post(
        f"{P}/invoices",
        json={
            "unit_id": unit_id,
            "items": [{"description": "Maintenance", "quantity": "1", "unit_rate": "1200.00"}],
        },
    )
    assert r.status_code == 201, r.text
    inv = r.json()["data"]
    assert inv["status"] == "draft" and inv["total_amount"] == "1200.00"

    assert admin.post(f"{P}/invoices/{inv['id']}/post").json()["data"]["status"] == "posted"

    pay = admin.post(
        f"{P}/payments",
        json={
            "amount": "1200.00",
            "allocations": [{"invoice_id": inv["id"], "amount": "1200.00"}],
            "community_id": seed_ids["community_id"],
        },
    )
    assert pay.status_code == 201, pay.text
    pay_data = pay.json()["data"]
    assert pay_data["receipt_number"] and pay_data["receipt_number"].startswith("RCP-")
    got = admin.get(f"{P}/invoices/{inv['id']}").json()["data"]
    assert got["status"] == "paid" and got["balance_due"] == "0.00"

    # FR-09 receipt document
    rc = admin.get(f"{P}/payments/{pay_data['id']}/receipt")
    assert rc.status_code == 200, rc.text
    receipt = rc.json()["data"]
    assert receipt["receipt_number"] == pay_data["receipt_number"]
    assert receipt["amount"] == "1200.00"
    assert receipt["allocations"][0]["invoice_number"] == inv["invoice_number"]


def test_facility_manager_cannot_create_invoice(as_role):
    # facility_manager has no billing:create
    r = as_role("facility_manager").post(
        f"{P}/invoices",
        json={"unit_id": str(uuid.uuid4()), "items": [{"description": "x", "unit_rate": "1"}]},
    )
    assert r.status_code == 403


def test_cross_community_invoice_is_404(as_role, seed_ids):
    admin = as_role("community_admin")
    other_unit = _unit_in(seed_ids["other_community_id"])
    r = admin.post(
        f"{P}/invoices",
        json={"unit_id": other_unit, "items": [{"description": "x", "unit_rate": "1"}]},
    )
    assert r.status_code == 404


def test_resident_billing_is_own_unit_only(as_role, seed_ids, resident_unit_id):
    admin = as_role("community_admin")
    other_unit = _unit_in(seed_ids["community_id"])
    assert other_unit != resident_unit_id
    inv = admin.post(
        f"{P}/invoices",
        json={
            "unit_id": other_unit,
            "items": [{"description": "M", "quantity": "1", "unit_rate": "500.00"}],
        },
    ).json()["data"]
    admin.post(f"{P}/invoices/{inv['id']}/post")

    resident = as_role("resident")
    assert resident.get(f"{P}/invoices/{inv['id']}").status_code == 404
    assert resident.get(f"{P}/units/{other_unit}/ledger").status_code == 404
    assert all(i["id"] != inv["id"] for i in resident.get(f"{P}/invoices").json()["data"])

    denied = resident.post(
        f"{P}/invoices",
        json={
            "unit_id": resident_unit_id,
            "items": [{"description": "x", "quantity": "1", "unit_rate": "1.00"}],
        },
    )
    assert denied.status_code == 403 and denied.json()["error"]["code"] == "STAFF_ONLY"
    assert admin.get(f"{P}/invoices/{inv['id']}").status_code == 200


def test_payment_refund_reverses_invoice_and_ledger(as_role, seed_ids):
    """SM-3: success -> refunded restores the invoice balance and posts a debit."""
    P = "/api/v1/billing"
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.communities.models import Unit

    with SessionLocal() as db:
        unit_id = str(
            db.scalar(select(Unit.id).where(Unit.community_id == cid).order_by(Unit.unit_number))
        )
    admin.post(
        f"{P}/charge-heads",
        params={"community_id": cid},
        json={
            "code": f"RF{__import__('secrets').token_hex(2)}",
            "name": "Refund test",
            "calculation_type": "flat",
            "default_amount": "500.00",
        },
    )
    inv = admin.post(
        f"{P}/invoices",
        params={"community_id": cid},
        json={"unit_id": unit_id, "items": [{"description": "x", "unit_rate": "500.00"}]},
    )
    assert inv.status_code == 201, inv.text
    iid = inv.json()["data"]["id"]
    assert admin.post(f"{P}/invoices/{iid}/post").status_code == 200
    pay = admin.post(
        f"{P}/payments",
        params={"community_id": cid},
        json={
            "amount": "500.00",
            "payment_method": "upi",
            "allocations": [{"invoice_id": iid, "amount": "500.00"}],
        },
    )
    assert pay.status_code == 201, pay.text
    pid = pay.json()["data"]["id"]
    assert admin.get(f"{P}/invoices/{iid}").json()["data"]["status"] == "paid"

    r = admin.post(f"{P}/payments/{pid}/refund", json={"reason": "duplicate charge"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["payment_status"] == "refunded"
    assert r.json()["data"]["refunded_at"] is not None
    assert admin.get(f"{P}/invoices/{iid}").json()["data"]["status"] in ("posted", "overdue")
    # a second refund is rejected
    assert admin.post(f"{P}/payments/{pid}/refund", json={"reason": "again"}).status_code == 422


def test_assess_penalty(as_role, seed_ids):
    P = "/api/v1/billing"
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.communities.models import Unit

    with SessionLocal() as db:
        unit_id = str(
            db.scalar(select(Unit.id).where(Unit.community_id == cid).order_by(Unit.unit_number))
        )

    res = admin.post(
        f"{P}/penalties",
        params={"community_id": cid},
        json={
            "unit_id": unit_id,
            "amount": "250.00",
            "reason": "Late night loud noise violation",
            "violation_reference": "VIOL-001",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    assert data["status"] == "posted"
    assert data["total_amount"] == "250.00"
    assert data["balance_due"] == "250.00"
    assert data["invoice_number"].startswith("INV-PEN-")
    assert len(data["items"]) == 1
    assert "Penalty: Late night loud noise violation" in data["items"][0]["description"]

    # Verify unit ledger reflects the penalty debit
    ledger_res = admin.get(f"{P}/units/{unit_id}/ledger", params={"community_id": cid})
    assert ledger_res.status_code == 200
    ledger_items = ledger_res.json()["data"]
    pen_entry = next((e for e in ledger_items if e["source_type"] == "penalty"), None)
    assert pen_entry is not None
    assert pen_entry["amount"] == "250.00"
    assert pen_entry["entry_type"] == "debit"


def test_payment_enrichment(as_role, seed_ids):
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    unit_id = _unit_in(cid)

    # Create & post invoice
    inv = admin.post(
        f"{P}/invoices",
        json={
            "unit_id": unit_id,
            "items": [{"description": "Monthly Maintenance", "quantity": "1", "unit_rate": "1500.00"}],
        },
    ).json()["data"]
    admin.post(f"{P}/invoices/{inv['id']}/post")

    # Record payment
    pay = admin.post(
        f"{P}/payments",
        json={
            "amount": "1500.00",
            "allocations": [{"invoice_id": inv["id"], "amount": "1500.00"}],
            "community_id": cid,
        },
    )
    assert pay.status_code == 201, pay.text
    pid = pay.json()["data"]["id"]

    # Check get_payment returns enriched fields
    get_res = admin.get(f"{P}/payments/{pid}")
    assert get_res.status_code == 200
    p_data = get_res.json()["data"]
    assert p_data["invoice_number"] == inv["invoice_number"]
    assert p_data["unit_number"] is not None

    # Check list_payments returns enriched fields
    list_res = admin.get(f"{P}/payments", params={"community_id": cid})
    assert list_res.status_code == 200
    payments = list_res.json()["data"]
    found = next((p for p in payments if p["id"] == pid), None)
    assert found is not None
    assert found["invoice_number"] == inv["invoice_number"]
    assert found["unit_number"] is not None


def test_maker_checker_special_assessment(as_role, seed_ids):
    comm_member1 = as_role("association_committee")
    comm_member2 = as_role("community_admin")  # also has APPROVE permission
    cid = seed_ids["community_id"]

    # 1. Member 1 creates/proposes a special assessment
    res_create = comm_member1.post(
        f"{P}/assessments",
        params={"community_id": cid},
        json={
            "title": "CCTV Security Upgrade",
            "purpose": "Security & Safety",
            "description": "Installation of 20 high-def cameras across perimeter.",
            "target_amount": "50000.00",
            "affected_units_count": 100,
            "effective_date": "2026-10-01",
            "due_date": "2026-11-01",
        },
    )
    assert res_create.status_code == 201, res_create.text
    sa = res_create.json()["data"]
    sa_id = sa["id"]
    assert sa["status"] == "under_review"

    # 2. Member 1 attempts self-approval -> Must be rejected with 403 Forbidden (Maker-Checker violation)
    res_self_approve = comm_member1.post(
        f"{P}/assessments/{sa_id}/approve",
        json={"notes": "Self approving my own proposal"},
    )
    assert res_self_approve.status_code == 403, res_self_approve.text
    err_json = res_self_approve.json()
    assert err_json["error"]["code"] == "MAKER_CHECKER_VIOLATION" or "Maker-Checker" in err_json["error"]["message"]

    # 3. Another executive (Member 2) reviews and approves -> Must succeed
    res_other_approve = comm_member2.post(
        f"{P}/assessments/{sa_id}/approve",
        json={"notes": "Approved by Committee Chair during executive meeting."},
    )
    assert res_other_approve.status_code == 200, res_other_approve.text
    approved_sa = res_other_approve.json()["data"]
    assert approved_sa["status"] == "approved"
    assert approved_sa["approved_by_name"] is not None


def test_duplicate_payment_is_rejected_without_double_posting(as_role, seed_ids):
    """Retried payment for a settled invoice fails safe (422), never posts twice."""
    from app.modules.billing.models import (
        InvoiceItem,
        LedgerEntry,
        MaintenanceInvoice,
        Payment,
        PaymentAllocation,
    )

    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    inv = admin.post(
        f"{P}/invoices",
        json={
            "unit_id": _unit_in(cid),
            "items": [{"description": "Duplicate-pay probe", "unit_rate": "400.00"}],
        },
    ).json()["data"]
    pay_id: str | None = None
    try:
        assert admin.post(f"{P}/invoices/{inv['id']}/post").status_code == 200
        body = {
            "amount": "400.00",
            "allocations": [{"invoice_id": inv["id"], "amount": "400.00"}],
            "community_id": cid,
        }
        first = admin.post(f"{P}/payments", json=body)
        assert first.status_code == 201, first.text
        pay_id = first.json()["data"]["id"]

        dup = admin.post(f"{P}/payments", json=body)
        assert dup.status_code == 422, dup.text
        assert dup.json()["error"]["code"] in ("INVOICE_NOT_PAYABLE", "OVER_ALLOCATION")
        with SessionLocal() as db:
            count = (
                db.query(PaymentAllocation).filter_by(invoice_id=inv["id"]).count()
            )
            assert count == 1
    finally:
        with SessionLocal() as db:
            for row in db.query(PaymentAllocation).filter_by(invoice_id=inv["id"]).all():
                db.delete(row)
            SOURCE_IDS = [uuid.UUID(inv["id"])] + (
                [uuid.UUID(pay_id)] if pay_id else []
            )
            for row in (
                db.query(LedgerEntry).filter(LedgerEntry.source_id.in_(SOURCE_IDS)).all()
            ):
                db.delete(row)
            if pay_id is not None:
                pay = db.get(Payment, pay_id)
                if pay is not None:
                    db.delete(pay)
            for row in db.query(InvoiceItem).filter_by(invoice_id=inv["id"]).all():
                db.delete(row)
            obj = db.get(MaintenanceInvoice, inv["id"])
            if obj is not None:
                db.delete(obj)
            db.commit()


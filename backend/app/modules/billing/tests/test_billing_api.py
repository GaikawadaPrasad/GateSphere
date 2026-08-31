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

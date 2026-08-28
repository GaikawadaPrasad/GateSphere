"""Integration tests — Notifications router, RBAC, tenant scope."""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.users.models import User

P = "/api/v1/notifications"


def _resident_id() -> str:
    with SessionLocal() as db:
        return str(db.scalar(select(User).where(User.email == "resident@gatesphere.com")).id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "notifications"


def test_inbox_needs_auth(client):
    assert client.get(P).status_code == 401


def test_resident_cannot_dispatch(as_role):
    r = as_role("resident").post(
        f"{P}/dispatch",
        json={
            "recipient_user_id": _resident_id(),
            "notification_type": "x",
            "title": "a",
            "message": "b",
        },
    )
    assert r.status_code == 403


def test_admin_dispatches_resident_reads(as_role, seed_ids):
    admin = as_role("community_admin")
    d = admin.post(
        f"{P}/dispatch",
        json={
            "recipient_user_id": _resident_id(),
            "notification_type": "notice",
            "title": "Lift maintenance",
            "message": "Lift 2 down 3-5pm",
            "channels": ["in_app", "sms"],
            "community_id": seed_ids["community_id"],
        },
    )
    assert d.status_code == 201, d.text
    nid = d.json()["data"]["id"]
    assert len(d.json()["data"]["deliveries"]) == 2

    resident = as_role("resident")
    lst = resident.get(P, params={"unread_only": True})
    assert lst.status_code == 200
    assert any(n["id"] == nid for n in lst.json()["data"])
    assert resident.post(f"{P}/{nid}/read").json()["data"]["is_read"] is True


def test_preferences_roundtrip(as_role):
    resident = as_role("resident")
    r = resident.put(f"{P}/me/preferences", json={"channel": "email", "is_enabled": False})
    assert r.status_code == 200, r.text
    got = resident.get(f"{P}/me/preferences")
    assert any(p["channel"] == "email" and p["is_enabled"] is False for p in got.json()["data"])


def test_domain_event_lands_in_inbox(as_role, seed_ids):
    """Billing: posting an invoice notifies the billed resident."""
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.residents.models import ResidentProfile, UnitOccupancy
    from app.modules.users.models import User

    with SessionLocal() as db:
        demo = db.scalar(select(User).where(User.email == "resident@gatesphere.com"))
        occ = db.scalar(
            select(UnitOccupancy)
            .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
            .where(ResidentProfile.user_id == demo.id, UnitOccupancy.is_active.is_(True))
        )
        unit_id = str(occ.unit_id)
    admin = as_role("community_admin")
    inv = admin.post(
        "/api/v1/billing/invoices",
        json={"unit_id": unit_id, "items": [{"description": "Maint", "unit_rate": "500.00"}]},
    ).json()["data"]["id"]
    admin.post(f"/api/v1/billing/invoices/{inv}/post")

    # the seeded resident owns that unit -> should have a billing notification
    resident = as_role("resident")
    lst = resident.get(P, params={"unread_only": True}).json()["data"]
    assert any(n["notification_type"] == "billing.invoice_posted" for n in lst)

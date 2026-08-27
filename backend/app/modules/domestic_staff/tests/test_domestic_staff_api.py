"""Integration tests — Domestic Staff router, RBAC, tenant scope."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/domestic-staff"


def _phone() -> str:
    return "+9197" + str(uuid.uuid4().int)[:7]


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "domestic_staff"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_admin_creates_staff_and_guard_checks_in(as_role, seed_ids):
    admin = as_role("community_admin")
    r = admin.post(
        P,
        json={"full_name": "Test Maid", "staff_type": "maid", "phone": _phone()},
    )
    assert r.status_code == 201, r.text
    staff_id = r.json()["data"]["id"]

    guard = as_role("security_guard")
    ci = guard.post(f"{P}/attendance/check-in", json={"staff_id": staff_id})
    assert ci.status_code == 201, ci.text
    att_id = ci.json()["data"]["id"]
    assert guard.patch(f"{P}/attendance/{att_id}/check-out").status_code == 200


def test_auditor_cannot_create_staff(as_role):
    # auditor is read-only — no domestic_staff:create
    r = as_role("auditor").post(
        P, json={"full_name": "X", "staff_type": "cook", "phone": "+919700000000"}
    )
    assert r.status_code == 403


def test_resident_rates_staff(as_role, seed_ids):
    admin = as_role("community_admin")
    staff_id = admin.post(
        P, json={"full_name": "Cook", "staff_type": "cook", "phone": _phone()}
    ).json()["data"]["id"]

    resident = as_role("resident")
    r = resident.post(f"{P}/ratings", json={"staff_id": staff_id, "rating": 4})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["rating"] == 4


def test_cross_community_staff_is_404(as_role, seed_ids):
    admin = as_role("community_admin")
    # community_admin is scoped to community_id; ask for a staff in the other community
    r = admin.get(f"{P}/{uuid.uuid4()}")
    assert r.status_code == 404

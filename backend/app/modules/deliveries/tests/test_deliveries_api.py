"""Integration tests — Deliveries router, RBAC, tenant scope."""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/deliveries"


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "deliveries"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_guard_logs_resident_approves_guard_completes(as_role, seed_ids):
    guard = as_role("security_guard")
    unit_id = _unit_in(seed_ids["community_id"])
    r = guard.post(
        P, json={"unit_id": unit_id, "delivery_type": "courier", "provider_name": "BlueDart"}
    )
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["approval_status"] == "pending"

    resident = as_role("resident")
    ok = resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"})
    assert ok.status_code == 200, ok.text

    arr = guard.post(f"{P}/{d['id']}/arrival", json={})
    assert arr.status_code == 200, arr.text
    assert guard.post(f"{P}/{d['id']}/delivered").status_code == 200


def test_protocol_upsert_requires_approve_perm(as_role, seed_ids):
    guard = as_role("security_guard")
    r = guard.put(
        f"{P}/protocols", json={"delivery_type": "food", "protocol_type": "collect_at_gate"}
    )
    assert r.status_code == 403

    admin = as_role("community_admin")
    r = admin.put(
        f"{P}/protocols",
        json={"delivery_type": "food", "allow_direct_entry": True},
    )
    assert r.status_code == 200, r.text


def test_cross_community_unit_is_404(as_role, seed_ids):
    guard = as_role("security_guard")
    other = _unit_in(seed_ids["other_community_id"])
    r = guard.post(P, json={"unit_id": other, "delivery_type": "food"})
    assert r.status_code == 404

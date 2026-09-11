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
        if u is None:
            from app.modules.communities.models import Floor, Tower
            tower = db.scalar(select(Tower).where(Tower.community_id == community_id))
            if not tower:
                tower = Tower(community_id=community_id, name="Tower T", code="TT")
                db.add(tower)
                db.flush()
            floor = db.scalar(select(Floor).where(Floor.tower_id == tower.id))
            if not floor:
                floor = Floor(community_id=community_id, tower_id=tower.id, floor_number=1)
                db.add(floor)
                db.flush()
            u = Unit(
                community_id=community_id,
                tower_id=tower.id,
                floor_id=floor.id,
                unit_number="U-999",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "deliveries"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_guard_logs_resident_approves_guard_completes(as_role, seed_ids, resident_unit_id):
    guard = as_role("security_guard")
    unit_id = resident_unit_id  # the resident may only approve deliveries for a unit they occupy
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


def test_resident_cannot_touch_other_units_delivery(as_role, seed_ids, resident_unit_id):
    guard = as_role("security_guard")
    other_unit = _unit_in(seed_ids["community_id"])
    assert other_unit != resident_unit_id
    d = guard.post(
        P,
        json={"unit_id": other_unit, "delivery_type": "courier", "provider_name": "X"},
    ).json()["data"]

    resident = as_role("resident")
    assert resident.get(f"{P}/{d['id']}").status_code == 404
    assert (
        resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"}).status_code == 404
    )
    assert all(x["id"] != d["id"] for x in resident.get(P).json()["data"])
    assert as_role("community_admin").get(f"{P}/{d['id']}").status_code == 200

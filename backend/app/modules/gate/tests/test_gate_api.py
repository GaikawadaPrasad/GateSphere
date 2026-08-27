"""Integration tests — Gate router, RBAC, tenant scope."""

from __future__ import annotations

import secrets

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Gate

P = "/api/v1/gate"


def _gate_in(community_id: str) -> str:
    with SessionLocal() as db:
        g = db.scalar(select(Gate).where(Gate.community_id == community_id).order_by(Gate.code))
        return str(g.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "gate"


def test_events_list_needs_auth(client):
    assert client.get(f"{P}/events").status_code == 401


def test_guard_logs_event_and_lists(as_role, seed_ids):
    guard = as_role("security_guard")
    gate_id = _gate_in(seed_ids["community_id"])
    r = guard.post(f"{P}/events", json={"gate_id": gate_id, "event_type": "patrol_check"})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["event_type"] == "patrol_check"
    lst = guard.get(f"{P}/events", params={"gate_id": gate_id})
    assert lst.status_code == 200
    assert any(e["event_type"] == "patrol_check" for e in lst.json()["data"])


def test_resident_can_raise_but_not_acknowledge_alert(as_role, seed_ids):
    resident = as_role("resident")
    r = resident.post(
        f"{P}/alerts",
        json={
            "alert_type": "medical",
            "severity": "high",
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 201, r.text
    alert_id = r.json()["data"]["id"]
    # resident has no gate:update
    assert resident.post(f"{P}/alerts/{alert_id}/acknowledge").status_code == 403
    # the person who raised it can cancel it
    assert resident.post(f"{P}/alerts/{alert_id}/cancel").status_code == 200

    sup = as_role("security_supervisor")
    r2 = sup.post(
        f"{P}/alerts",
        json={"alert_type": "fire", "community_id": seed_ids["community_id"]},
    )
    alert2 = r2.json()["data"]["id"]
    assert sup.post(f"{P}/alerts/{alert2}/acknowledge").status_code == 200
    assert sup.post(f"{P}/alerts/{alert2}/resolve", json={}).status_code == 200


def test_cross_community_gate_event_is_404(as_role, seed_ids):
    sup = as_role("security_supervisor")
    other_gate = _gate_in(seed_ids["other_community_id"])
    r = sup.post(f"{P}/events", json={"gate_id": other_gate, "event_type": "gate_open"})
    assert r.status_code == 404


def test_supervisor_creates_roster(as_role, seed_ids):
    sup = as_role("security_supervisor")
    guard = _guard_user_id()
    # random minute keeps the (community, guard, date, start) unique across runs
    start = f"07:{secrets.randbelow(60):02d}:00"
    r = sup.post(
        f"{P}/rosters",
        json={
            "guard_user_id": guard,
            "shift_date": "2026-09-15",
            "shift_start": start,
            "shift_end": "19:00:00",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["status"] == "planned"
    # cleanup so the row does not accumulate
    with SessionLocal() as db:
        from app.modules.gate.models import GuardRoster

        obj = db.get(GuardRoster, r.json()["data"]["id"])
        if obj is not None:
            db.delete(obj)
            db.commit()


def _guard_user_id() -> str:
    from app.modules.users.models import User

    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == "security_guard@gatesphere.com"))
        return str(u.id)

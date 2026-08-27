"""Integration tests — Audit Logging query API (FR-16)."""

from __future__ import annotations

P = "/api/v1/audit"


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "audit"


def test_logs_need_permission(as_role):
    # community_admin has every permission EXCEPT audit:*
    assert as_role("community_admin").get(f"{P}/logs").status_code == 403


def test_auditor_reads_scoped_logs(as_role, seed_ids):
    # generate an audit row first (guard logs a gate event)
    guard = as_role("security_guard")
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.communities.models import Gate

    with SessionLocal() as db:
        gate_id = str(
            db.scalar(
                select(Gate)
                .where(Gate.community_id == seed_ids["community_id"])
                .order_by(Gate.code)
            ).id
        )
    guard.post("/api/v1/gate/events", json={"gate_id": gate_id, "event_type": "patrol_check"})

    auditor = as_role("auditor")
    r = auditor.get(f"{P}/logs", params={"module": "gate", "action": "event.log"})
    assert r.status_code == 200, r.text
    assert r.json()["meta"]["total"] >= 1
    first = r.json()["data"][0]
    assert first["module"] == "gate"

    detail = auditor.get(f"{P}/logs/{first['id']}")
    assert detail.status_code == 200 and detail.json()["data"]["id"] == first["id"]


def test_csv_export_needs_export_permission(as_role):
    r = as_role("auditor").get(f"{P}/logs.csv", params={"module": "gate"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0].startswith("created_at,")


def test_community_admin_gets_403_on_csv(as_role):
    assert as_role("community_admin").get(f"{P}/logs.csv").status_code == 403

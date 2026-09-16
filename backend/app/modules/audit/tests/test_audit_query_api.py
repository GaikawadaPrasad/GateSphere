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


def test_community_scoped_auditor_sees_only_own_community(auth_client, seed_ids):
    import uuid
    from conftest import csrf_cookie_value
    from fastapi.testclient import TestClient
    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.main import app
    from app.modules.users.models import User

    email = f"comm-auditor-{uuid.uuid4().hex[:8]}@example.com"
    pwd = "CommAuditor2026!"
    cid = seed_ids["community_id"]
    other_cid = seed_ids["other_community_id"]

    try:
        # 1. Create auditor for community_id
        r = auth_client.post(
            "/api/v1/users",
            json={
                "email": email,
                "full_name": "Scoped Auditor",
                "password": pwd,
                "role_slug": "auditor",
                "community_id": cid,
            },
        )
        assert r.status_code == 201, r.text

        # 2. Login as the community auditor
        c = TestClient(app)
        lr = c.post("/api/v1/auth/login", json={"email": email, "password": pwd})
        assert lr.status_code == 200, lr.text
        c.headers.update({"X-CSRF-Token": csrf_cookie_value(c)})

        # 3. Query audit logs - all rows must belong to community_id
        logs_res = c.get(f"{P}/logs")
        assert logs_res.status_code == 200, logs_res.text
        data = logs_res.json()["data"]
        for row in data:
            assert row["community_id"] == cid

        # 4. Attempting to query another community's logs must be rejected
        cross_res = c.get(f"{P}/logs", params={"community_id": other_cid})
        assert cross_res.status_code in (403, 404)
        c.close()
    finally:
        with SessionLocal() as db:
            u = db.scalar(select(User).where(User.email == email.lower()))
            if u is not None:
                db.delete(u)
                db.commit()

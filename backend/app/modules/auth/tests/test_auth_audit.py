"""FR-01 / TRD §5.2 — login success/failure and logout are written to the audit log."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

AUDIT = "/api/v1/audit/logs"


def _auth_actions(auth_client, action: str) -> int:
    r = auth_client.get(AUDIT, params={"module": "auth", "action": action})
    assert r.status_code == 200, r.text
    return r.json()["meta"]["total"]


def test_failed_login_is_audited(auth_client):
    before = _auth_actions(auth_client, "login.failed")
    bad = TestClient(app).post(
        "/api/v1/auth/login",
        json={"email": "super_admin@gatesphere.com", "password": "wrong-password"},
    )
    assert bad.status_code == 401
    assert _auth_actions(auth_client, "login.failed") >= before + 1


def test_login_and_logout_are_audited(auth_client):
    before_in = _auth_actions(auth_client, "login.success")
    before_out = _auth_actions(auth_client, "logout")

    c = TestClient(app)
    r = c.post(
        "/api/v1/auth/login",
        json={"email": "security_guard@gatesphere.com", "password": "security_guard@Gate2026!"},
    )
    assert r.status_code == 200
    c.headers.update({"X-CSRF-Token": c.cookies.get("gs_csrf")})
    assert c.post("/api/v1/auth/logout").status_code == 204

    assert _auth_actions(auth_client, "login.success") >= before_in + 1
    assert _auth_actions(auth_client, "logout") >= before_out + 1

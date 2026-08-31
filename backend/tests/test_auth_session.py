"""Session lifecycle: DB-backed sessions are revoked on logout (AGENTS.md §7),
and role sessions are independent — one login/logout never touches another (FR-01)."""

from conftest import csrf_cookie_value
from fastapi.testclient import TestClient

from app.main import app

DEMO_EMAIL = "super_admin@gatesphere.com"
DEMO_PASSWORD = "super_admin@Gate2026!"


def test_login_me_logout_revokes_session(client):
    r = client.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    assert r.json()["data"]["active_role"] == "super_admin"
    assert r.json()["data"]["session_bucket"] == "superadmin"
    csrf = csrf_cookie_value(client)
    assert "gatesphere_superadmin_session" in client.cookies

    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["data"]["email"] == DEMO_EMAIL

    r = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204

    # Cookie is still sent by the test client, but the DB row is revoked.
    client.cookies.set("gatesphere_superadmin_session", "stale-but-present")
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_logout_needs_csrf(client):
    r = client.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    r = client.post("/api/v1/auth/logout")  # no X-CSRF-Token
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "CSRF_INVALID"


def test_two_role_sessions_coexist_in_one_jar_and_logout_is_isolated():
    """Super Admin + Resident logged in through the SAME cookie jar. Logging the
    resident out must leave the super-admin session fully alive, and vice-versa."""
    jar = TestClient(app)

    r = jar.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    r = jar.post(
        "/api/v1/auth/login",
        json={"email": "resident@gatesphere.com", "password": "resident@Gate2026!"},
    )
    assert r.status_code == 200

    # both session cookies live in the jar at once
    assert "gatesphere_superadmin_session" in jar.cookies
    assert "gatesphere_resident_session" in jar.cookies
    sa_csrf = jar.cookies.get("gatesphere_superadmin_csrf")
    res_csrf = jar.cookies.get("gatesphere_resident_csrf")

    # ambiguous without a selector
    assert jar.get("/api/v1/auth/me").status_code == 401
    # selector picks the session
    r = jar.get("/api/v1/auth/me", headers={"X-Session-Role": "resident"})
    assert r.status_code == 200 and r.json()["data"]["email"] == "resident@gatesphere.com"
    r = jar.get("/api/v1/auth/me", headers={"X-Session-Role": "super_admin"})
    assert r.status_code == 200 and r.json()["data"]["email"] == DEMO_EMAIL

    # log the RESIDENT out
    r = jar.post(
        "/api/v1/auth/logout",
        headers={"X-Session-Role": "resident", "X-CSRF-Token": res_csrf},
    )
    assert r.status_code == 204

    # resident session is gone...
    jar.cookies.set("gatesphere_resident_session", "stale")
    assert jar.get("/api/v1/auth/me", headers={"X-Session-Role": "resident"}).status_code == 401
    # ...but the super-admin session is untouched
    r = jar.get("/api/v1/auth/me", headers={"X-Session-Role": "super_admin"})
    assert r.status_code == 200 and r.json()["data"]["email"] == DEMO_EMAIL

    # clean up the super-admin session too
    jar.post(
        "/api/v1/auth/logout",
        headers={"X-Session-Role": "super_admin", "X-CSRF-Token": sa_csrf},
    )
    jar.close()


def test_wrong_role_at_login_is_rejected():
    """Asking to log in as a role the account does not hold is refused."""
    c = TestClient(app)
    r = c.post(
        "/api/v1/auth/login",
        json={
            "email": "resident@gatesphere.com",
            "password": "resident@Gate2026!",
            "role": "super_admin",
        },
    )
    # resident is not superadmin and holds no super_admin grant
    assert r.status_code == 401 and r.json()["error"]["code"] == "ROLE_NOT_GRANTED"
    c.close()


def test_session_row_records_role_and_activity():
    c = TestClient(app)
    c.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.auth.models import UserSession
    from app.modules.users.models import User

    with SessionLocal() as db:
        uid = db.scalar(select(User.id).where(User.email == DEMO_EMAIL))
        row = db.scalars(
            select(UserSession)
            .where(UserSession.user_id == uid, UserSession.revoked_at.is_(None))
            .order_by(UserSession.created_at.desc())
        ).first()
        assert row.role_slug == "super_admin"
        assert row.cookie_bucket == "superadmin"
        assert row.last_activity_at is not None
        assert row.expires_at > row.created_at
    c.close()

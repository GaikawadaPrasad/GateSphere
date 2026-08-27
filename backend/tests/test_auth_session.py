"""Session lifecycle: DB-backed sessions are revoked on logout (AGENTS.md §7)."""

DEMO_EMAIL = "super_admin@gatesphere.com"
DEMO_PASSWORD = "super_admin@Gate2026!"


def test_login_me_logout_revokes_session(client):
    r = client.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    csrf = client.cookies.get("gs_csrf")

    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["data"]["email"] == DEMO_EMAIL

    r = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204

    # Cookie is still sent by the test client, but the DB row is revoked.
    client.cookies.set("gs_session", "stale-but-present")
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_logout_needs_csrf(client):
    r = client.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    r = client.post("/api/v1/auth/logout")  # no X-CSRF-Token
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "CSRF_INVALID"

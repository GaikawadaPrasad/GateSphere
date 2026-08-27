"""Root pytest fixtures — visible to tests under both tests/ and app/modules/**/tests/.

Integration tests expect Postgres + Redis reachable via the env vars in .env
(`docker compose exec backend pytest` sets these automatically).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

DEMO_EMAIL = "super_admin@gatesphere.com"
DEMO_PASSWORD = "super_admin@Gate2026!"


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def auth_client(client: TestClient) -> TestClient:
    """Logged-in client using the seeded super-admin. Requires `make seed` first."""
    r = client.post("/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    client.headers.update({"X-CSRF-Token": client.cookies.get("gs_csrf")})
    return client

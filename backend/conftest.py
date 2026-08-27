"""Shared pytest fixtures — visible to tests under both tests/ and app/modules/**/tests/.

Integration tests run against the real Postgres + Redis from `docker compose`
(`docker compose exec backend pytest`). They assume the seed data is loaded
(`make up` seeds on start; `make seed` reloads).
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.main import app
from app.modules.communities.models import Community
from app.modules.users.models import Role, User, UserRole

DEMO_DOMAIN = "gatesphere.com"


def demo_password(role_slug: str) -> str:
    return f"{role_slug}@Gate2026!"


DEMO_EMAIL = f"super_admin@{DEMO_DOMAIN}"
DEMO_PASSWORD = demo_password("super_admin")


@pytest.fixture(autouse=True, scope="session")
def _disable_login_rate_limit():
    """Tests log in many times — the 5/min limiter is not what we're testing here."""
    from app.modules.auth.router import limiter

    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def _login(client: TestClient, email: str, password: str) -> TestClient:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    client.headers.update({"X-CSRF-Token": client.cookies.get("gs_csrf")})
    return client


@pytest.fixture()
def auth_client(client: TestClient) -> TestClient:
    """Logged in as the seeded Super Admin (global scope)."""
    return _login(client, DEMO_EMAIL, DEMO_PASSWORD)


@pytest.fixture()
def as_role(client: TestClient):
    """Factory: `as_role("community_admin")` -> a logged-in client for that seeded role."""

    def _make(role_slug: str) -> TestClient:
        return _login(client, f"{role_slug}@{DEMO_DOMAIN}", demo_password(role_slug))

    return _make


@pytest.fixture()
def seed_ids() -> dict:
    """Ids from the seed data most tests need."""
    with SessionLocal() as db:
        communities = db.scalars(select(Community).order_by(Community.code)).all()
        primary = communities[0]
        other = communities[1]
        ca_role = db.scalar(select(Role).where(Role.slug == "community_admin"))
        # which community is community_admin@ a member of?
        grant = db.scalar(
            select(UserRole)
            .join(User, User.id == UserRole.user_id)
            .where(User.email == f"community_admin@{DEMO_DOMAIN}", UserRole.role_id == ca_role.id)
        )
        ca_community = grant.community_id if grant else primary.id
        return {
            "community_id": str(ca_community),
            "other_community_id": str(other.id if other.id != ca_community else primary.id),
            "primary_community_id": str(primary.id),
        }


@pytest.fixture()
def unique_code() -> str:
    return "t" + uuid.uuid4().hex[:10]

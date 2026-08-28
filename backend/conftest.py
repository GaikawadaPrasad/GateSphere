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
def as_role():
    """Factory: `as_role("community_admin")` -> a fresh logged-in client for that seeded role.

    Each call returns an INDEPENDENT client so a test can hold several roles at once.
    """
    clients: list[TestClient] = []

    def _make(role_slug: str) -> TestClient:
        c = TestClient(app)
        clients.append(c)
        return _login(c, f"{role_slug}@{DEMO_DOMAIN}", demo_password(role_slug))

    yield _make
    for c in clients:
        c.close()


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


@pytest.fixture()
def confirmed_upload():
    """Factory: `confirmed_upload("ticket_attachment", community_id)` -> a managed file URL
    whose `managed_files` row is already `confirmed` (skips the real S3 round-trip so
    attachment/photo tests don't need to PUT bytes to MinIO).
    """
    from app.modules.uploads.catalogue import KINDS
    from app.modules.uploads.models import ManagedFile
    from app.services import storage

    created: list[uuid.UUID] = []

    def _make(kind_slug: str, community_id=None, content_type: str = "image/jpeg") -> str:
        kind = KINDS[kind_slug]
        key = f"{kind.prefix}/{community_id or 'x'}/{uuid.uuid4().hex}-test.jpg"
        with SessionLocal() as db:
            mf = ManagedFile(
                community_id=uuid.UUID(str(community_id)) if community_id else None,
                object_key=key,
                kind=kind_slug,
                declared_content_type=content_type,
                declared_size_bytes=1024,
                status="confirmed",
                detected_content_type=content_type,
                size_bytes=1024,
            )
            db.add(mf)
            db.commit()
            created.append(mf.id)
        return storage.public_url(key)

    yield _make
    with SessionLocal() as db:
        for fid in created:
            obj = db.get(ManagedFile, fid)
            if obj:
                db.delete(obj)
        db.commit()

"""Integration tests — User & Role management (FR-02)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.users.models import User

P = "/api/v1/users"


def _cleanup_email(email: str) -> None:
    with SessionLocal() as db:
        u = db.scalar(select(User).where(User.email == email.lower()))
        if u is not None:
            db.delete(u)
            db.commit()


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "users"


def test_list_needs_permission(as_role):
    assert as_role("resident").get(P).status_code == 403


def test_roles_list_exposes_permissions(auth_client):
    r = auth_client.get(f"{P}/roles")
    assert r.status_code == 200
    roles = {x["slug"]: x for x in r.json()["data"]}
    assert roles["super_admin"]["permissions"] == ["*"]
    assert "visitors:approve" in roles["security_supervisor"]["permissions"]


def test_admin_creates_user_grants_and_revokes_role(auth_client, seed_ids):
    email = f"newhire-{uuid.uuid4().hex[:8]}@example.com"
    try:
        r = auth_client.post(
            P,
            json={
                "email": email,
                "full_name": "New Hire",
                "password": "Sup3rSecret!!",
                "role_slug": "security_guard",
                "community_id": seed_ids["community_id"],
            },
        )
        assert r.status_code == 201, r.text
        data = r.json()["data"]
        uid = data["id"]
        assert len(data["roles"]) == 1 and data["roles"][0]["role_slug"] == "security_guard"

        # the new user can log in and hit a guard endpoint
        from fastapi.testclient import TestClient

        from app.main import app

        c = TestClient(app)
        lr = c.post("/api/v1/auth/login", json={"email": email, "password": "Sup3rSecret!!"})
        assert lr.status_code == 200
        c.headers.update({"X-CSRF-Token": c.cookies.get("gs_csrf")})
        assert c.get("/api/v1/gate/events").status_code == 200
        c.close()

        grant_id = data["roles"][0]["id"]
        assert auth_client.delete(f"{P}/{uid}/roles/{grant_id}").status_code == 204

        # deactivate
        assert (
            auth_client.patch(f"{P}/{uid}", json={"is_active": False}).json()["data"]["is_active"]
            is False
        )
    finally:
        _cleanup_email(email)


def test_duplicate_email_conflicts(auth_client):
    r = auth_client.post(
        P,
        json={
            "email": "super_admin@gatesphere.com",
            "full_name": "x",
            "password": "anotherlongpw1",
        },
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "EMAIL_TAKEN"


def test_community_admin_cannot_grant_global_role(as_role, seed_ids):
    admin = as_role("community_admin")
    email = f"x-{uuid.uuid4().hex[:8]}@example.com"
    try:
        uid = admin.post(
            P, json={"email": email, "full_name": "X", "password": "longpassword12"}
        ).json()["data"]["id"]
        r = admin.post(f"{P}/{uid}/roles", json={"role_slug": "auditor"})
        assert r.status_code == 403  # GLOBAL_ONLY
    finally:
        _cleanup_email(email)

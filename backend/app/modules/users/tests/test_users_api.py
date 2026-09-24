"""Integration tests — User & Role management (FR-02)."""

from __future__ import annotations

import uuid
from collections.abc import Callable

from fastapi.testclient import TestClient
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
        from conftest import csrf_cookie_value

        c.headers.update({"X-CSRF-Token": csrf_cookie_value(c)})
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
            P,
            json={
                "email": email,
                "full_name": "X",
                "password": "longpassword12",
                "role_slug": "resident",
            },
        ).json()["data"]["id"]
        r = admin.post(f"{P}/{uid}/roles", json={"role_slug": "auditor"})
        assert r.status_code == 403  # GLOBAL_ONLY
    finally:
        _cleanup_email(email)


def test_community_admin_cannot_create_or_view_unaffiliated_user(as_role, auth_client, seed_ids):
    """S-05: Non-global admins cannot create unaffiliated users or enumerate them."""
    admin = as_role("community_admin")
    email_unaff = f"unaff-{uuid.uuid4().hex[:8]}@example.com"
    try:
        # 1. Community admin cannot create a user without assigning a role
        res_create = admin.post(
            P, json={"email": email_unaff, "full_name": "No Role", "password": "longpassword12"}
        )
        assert res_create.status_code == 422
        assert res_create.json()["error"]["code"] == "ROLE_REQUIRED"

        # 2. Super admin creates an unaffiliated user
        res_super = auth_client.post(
            P, json={"email": email_unaff, "full_name": "No Role", "password": "longpassword12"}
        )
        assert res_super.status_code == 201
        unaff_id = res_super.json()["data"]["id"]

        # 3. Community admin cannot access unaffiliated user directly (404)
        assert admin.get(f"{P}/{unaff_id}").status_code == 404

        # 4. Community admin does not see unaffiliated user in list
        list_res = admin.get(P)
        assert list_res.status_code == 200
        emails = [u["email"] for u in list_res.json()["data"]]
        assert email_unaff not in emails
    finally:
        _cleanup_email(email_unaff)


def test_community_admin_can_create_community_auditor(as_role, seed_ids):
    admin = as_role("community_admin")
    email = f"auditor-{uuid.uuid4().hex[:8]}@example.com"
    try:
        r = admin.post(
            P,
            json={
                "email": email,
                "full_name": "Community Statutory Auditor",
                "password": "Auditor@Gate2026!",
                "role_slug": "auditor",
                "community_id": seed_ids["community_id"],
            },
        )
        assert r.status_code == 201, r.text
        data = r.json()["data"]
        assert len(data["roles"]) == 1
        assert data["roles"][0]["role_slug"] == "auditor"
        assert data["roles"][0]["community_id"] == seed_ids["community_id"]
    finally:
        _cleanup_email(email)


def test_security_supervisor_can_register_security_guard(as_role, seed_ids):
    supervisor = as_role("security_supervisor")
    email = f"guard-{uuid.uuid4().hex[:8]}@example.com"
    try:
        # 1. Register guard without passing community_id (matches frontend guardsApi.create)
        r = supervisor.post(
            P,
            json={
                "email": email,
                "full_name": "New Gate Guard",
                "password": "GuardPassword123!",
                "role_slug": "security_guard",
            },
        )
        assert r.status_code == 201, r.text
        data = r.json()["data"]
        assert len(data["roles"]) == 1
        assert data["roles"][0]["role_slug"] == "security_guard"
        assert data["roles"][0]["community_id"] == seed_ids["community_id"]

        # 2. Check guard appears in supervisor's guard list
        list_r = supervisor.get(f"{P}?role_slug=security_guard")
        assert list_r.status_code == 200
        guard_emails = [u["email"] for u in list_r.json()["data"]]
        assert email in guard_emails
    finally:
        _cleanup_email(email)


def test_incompatible_role_grant_blocked(as_role, seed_ids):
    admin = as_role("super_admin")
    email = f"mukesh-{uuid.uuid4().hex[:8]}@example.com"
    cid = seed_ids["community_id"]
    try:
        # 1. Create user with security_guard role
        create_res = admin.post(
            P,
            json={
                "email": email,
                "full_name": "mukeshreddy",
                "password": "Password123!",
                "role_slug": "security_guard",
                "community_id": cid,
            },
        )
        assert create_res.status_code == 201, create_res.text
        user_id = create_res.json()["data"]["id"]

        # 2. Attempt to grant vendor_technician while security_guard is active
        grant_res = admin.post(
            f"{P}/{user_id}/roles",
            json={"role_slug": "vendor_technician", "community_id": cid},
        )
        assert grant_res.status_code == 422, grant_res.text
        err = grant_res.json()["error"]
        assert err["code"] == "INCOMPATIBLE_ROLE"
        assert (
            grant_res.json()["message"]
            == "First revoke the Security Guard role, then Vendor/Technician can be granted."
        )
    finally:
        _cleanup_email(email)


def test_community_admin_cannot_change_credentials_of_multi_community_user(
    as_role: Callable[[str], TestClient], auth_client: TestClient, seed_ids: dict[str, str]
) -> None:
    """Re-audit #3 S-05 residual: a scoped admin may not change the email / password /
    active flag of an account that also holds a grant in another community."""
    email = f"shared-{uuid.uuid4().hex[:8]}@example.com"
    try:
        r = auth_client.post(
            P,
            json={
                "email": email,
                "full_name": "Shared Guard",
                "password": "Sup3rSecret!!",
                "role_slug": "security_guard",
                "community_id": seed_ids["community_id"],
            },
        )
        assert r.status_code == 201, r.text
        uid = r.json()["data"]["id"]
        g = auth_client.post(
            f"{P}/{uid}/roles",
            json={"role_slug": "security_guard", "community_id": seed_ids["other_community_id"]},
        )
        assert g.status_code == 201, g.text

        ca = as_role("community_admin")
        for body in (
            {"password": "An0therSecret!!"},
            {"email": f"x-{email}"},
            {"is_active": False},
        ):
            resp = ca.patch(f"{P}/{uid}", json=body)
            assert resp.status_code == 403, (body, resp.text)
            assert resp.json()["error"]["code"] == "ACCOUNT_SHARED"
        # A non-credential field in the admin's own community is still editable.
        assert ca.patch(f"{P}/{uid}", json={"full_name": "Renamed"}).status_code == 200
        # The platform admin can still change credentials.
        assert auth_client.patch(f"{P}/{uid}", json={"is_active": False}).status_code == 200
    finally:
        _cleanup_email(email)


def test_community_admin_can_change_credentials_of_own_community_user(
    as_role: Callable[[str], TestClient], seed_ids: dict[str, str]
) -> None:
    email = f"owned-{uuid.uuid4().hex[:8]}@example.com"
    ca = as_role("community_admin")
    try:
        r = ca.post(
            P,
            json={
                "email": email,
                "full_name": "Own Guard",
                "password": "Sup3rSecret!!",
                "role_slug": "security_guard",
                "community_id": seed_ids["community_id"],
            },
        )
        assert r.status_code == 201, r.text
        uid = r.json()["data"]["id"]
        assert ca.patch(f"{P}/{uid}", json={"password": "An0therSecret!!"}).status_code == 200
    finally:
        _cleanup_email(email)


def test_password_minimum_is_consistent_across_create_and_update(
    auth_client: TestClient, seed_ids: dict[str, str]
) -> None:
    """Re-audit #3 S-12: create and update enforce the same minimum length."""
    email = f"pwpolicy-{uuid.uuid4().hex[:8]}@example.com"
    try:
        short = "Abcdef12!"  # 9 chars — below PASSWORD_MIN_LENGTH
        body = {"email": email, "full_name": "Pw Policy", "role_slug": "security_guard"}
        body["community_id"] = seed_ids["community_id"]
        assert auth_client.post(P, json={**body, "password": short}).status_code == 422
        r = auth_client.post(P, json={**body, "password": "Sup3rSecret!!"})
        assert r.status_code == 201, r.text
        uid = r.json()["data"]["id"]
        assert auth_client.patch(f"{P}/{uid}", json={"password": short}).status_code == 422
    finally:
        _cleanup_email(email)

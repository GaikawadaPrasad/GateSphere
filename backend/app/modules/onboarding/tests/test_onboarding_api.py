"""Integration tests — onboarding router -> service -> DB (invitations, add/remove tenant)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.main import app
from app.modules.communities.models import Unit
from app.modules.onboarding.models import CommunityInvitation
from app.modules.users.models import User, UserRole

P = "/api/v1"


def _a_unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number.desc())
        )
        return str(u.id)


def _cleanup_email(email: str) -> None:
    with SessionLocal() as db:
        db.execute(
            CommunityInvitation.__table__.delete().where(
                CommunityInvitation.invited_email == email.lower()
            )
        )
        u = db.scalar(select(User).where(User.email == email.lower()))
        if u:
            db.delete(u)  # cascades resident_profiles -> unit_occupancies
        db.commit()


def test_health(client):
    r = client.get(f"{P}/onboarding/health")
    assert r.status_code == 200 and r.json()["data"]["module"] == "onboarding"


def test_create_invitation_requires_auth(client, seed_ids):
    r = client.post(
        f"{P}/communities/{seed_ids['community_id']}/invitations",
        json={"unit_id": str(uuid.uuid4()), "invited_email": "x@example.com"},
    )
    assert r.status_code in (401, 403)


def test_cross_tenant_invitation_is_404(as_role, seed_ids):
    ca = as_role("community_admin")
    other_unit = _a_unit_in(seed_ids["other_community_id"])
    r = ca.post(
        f"{P}/communities/{seed_ids['other_community_id']}/invitations",
        json={"unit_id": other_unit, "invited_email": "x@example.com"},
    )
    assert r.status_code == 404


def test_full_invitation_flow_new_account(as_role, seed_ids, unique_code):
    ca = as_role("community_admin")
    community_id = seed_ids["community_id"]
    unit_id = _a_unit_in(community_id)
    email = f"invitee-{unique_code}@example.com"
    try:
        r = ca.post(
            f"{P}/communities/{community_id}/invitations",
            json={
                "unit_id": unit_id,
                "invited_email": email,
                "full_name": "New Tenant",
                "occupancy_role": "tenant",
                "is_primary": True,
            },
        )
        assert r.status_code == 201, r.text
        token = r.json()["data"]["token"]
        assert r.json()["data"]["accept_url"].endswith(token)

        # public view — no auth
        pub = TestClient(app)
        rv = pub.get(f"{P}/invitations/{token}")
        assert rv.status_code == 200, rv.text
        body = rv.json()["data"]
        assert body["invited_email"] == email.lower()
        assert body["account_exists"] is False
        assert " / " in body["unit_label"]

        # accept — creates the account + profile + occupancy + role grant
        ra = pub.post(
            f"{P}/invitations/{token}/accept",
            json={"password": "s3cret-pass-123", "full_name": "New Tenant"},
        )
        assert ra.status_code == 200, ra.text
        data = ra.json()["data"]
        assert data["account_created"] is True
        assert data["logged_in"] is True
        assert len(data["occupancies"]) == 1

        with SessionLocal() as db:
            u = db.scalar(select(User).where(User.email == email.lower()))
            assert u is not None
            grant = db.scalar(
                select(UserRole).where(
                    UserRole.user_id == u.id, UserRole.community_id == uuid.UUID(community_id)
                )
            )
            assert grant is not None

        # invitation now accepted -> second accept fails
        assert (
            pub.post(
                f"{P}/invitations/{token}/accept", json={"password": "s3cret-pass-123"}
            ).status_code
            == 422
        )

        # the new tenant can sign in
        login = TestClient(app).post(
            f"{P}/auth/login", json={"email": email, "password": "s3cret-pass-123"}
        )
        assert login.status_code == 200
    finally:
        _cleanup_email(email)


def test_add_and_remove_tenant_directly(as_role, seed_ids, unique_code):
    ca = as_role("community_admin")
    community_id = seed_ids["community_id"]
    unit_id = _a_unit_in(community_id)
    email = f"direct-{unique_code}@example.com"
    try:
        r = ca.post(
            f"{P}/communities/{community_id}/tenants",
            json={
                "email": email,
                "full_name": "Direct Tenant",
                "unit_id": unit_id,
                "occupancy_role": "tenant",
                "password": "another-pass-9",
            },
        )
        assert r.status_code == 201, r.text
        profile_id = r.json()["data"]["resident_profile_id"]

        rem = ca.delete(f"{P}/communities/{community_id}/tenants/{profile_id}")
        assert rem.status_code == 200, rem.text
        assert rem.json()["data"]["profile_status"] == "moved_out"

        with SessionLocal() as db:
            u = db.scalar(select(User).where(User.email == email.lower()))
            grant = db.scalar(
                select(UserRole).where(
                    UserRole.user_id == u.id, UserRole.community_id == uuid.UUID(community_id)
                )
            )
            assert grant is None
    finally:
        _cleanup_email(email)

"""Integration tests — configurable RBAC router (global edits + per-community overrides)."""

from __future__ import annotations

from sqlalchemy import select

from app.core.rbac import ROLES
from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/rbac"


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        return str(
            db.scalar(
                select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
            ).id
        )


def test_health(client):
    r = client.get(f"{P}/health")
    assert r.status_code == 200 and r.json()["data"]["module"] == "rbac"


def test_roles_expose_defaults_for_every_role(auth_client):
    r = auth_client.get(f"{P}/roles")
    assert r.status_code == 200, r.text
    rows = {row["slug"]: row for row in r.json()["data"]}
    assert set(rows) == set(ROLES)
    for row in rows.values():
        assert "default_permissions" in row and isinstance(row["default_permissions"], list)
    assert rows["super_admin"]["is_wildcard"] is True


def test_permissions_list_needs_view_permission(as_role):
    assert as_role("domestic_staff").get(f"{P}/permissions").status_code == 403


def test_only_platform_admin_edits_global_role(as_role):
    ca = as_role("community_admin")
    r = ca.post(f"{P}/roles/facility_manager/permissions", json={"code": "billing:view"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PLATFORM_ADMIN_ONLY"


def test_platform_admin_add_then_reset_global_role(auth_client):
    try:
        r = auth_client.post(
            f"{P}/roles/facility_manager/permissions", json={"code": "billing:view"}
        )
        assert r.status_code == 200, r.text
        assert "billing:view" in r.json()["data"]["permissions"]
    finally:
        rr = auth_client.post(f"{P}/roles/facility_manager/permissions/reset")
        assert rr.status_code == 200
        assert set(rr.json()["data"]["permissions"]) == set(
            rr.json()["data"]["default_permissions"]
        )


def test_per_community_override_allow_and_deny(auth_client, seed_ids):
    cid = seed_ids["community_id"]
    base = f"{P}/communities/{cid}/roles/security_guard"
    try:
        r = auth_client.put(
            f"{base}/permissions",
            json={"allow": ["billing:view"], "deny": ["visitors:create"], "note": "test"},
        )
        assert r.status_code == 200, r.text
        eff = set(r.json()["data"]["effective_permissions"])
        assert "billing:view" in eff
        assert "visitors:create" not in eff

        got = auth_client.get(f"{base}/effective")
        assert got.status_code == 200
        assert "billing:view" in got.json()["data"]["allow"]

        conflict = auth_client.put(
            f"{base}/permissions", json={"allow": ["gate:view"], "deny": ["gate:view"]}
        )
        assert conflict.status_code == 422
        assert conflict.json()["error"]["code"] == "CONFLICTING_OVERRIDE"
    finally:
        auth_client.delete(f"{base}/permissions/billing:view")
        auth_client.delete(f"{base}/permissions/visitors:create")
        left = auth_client.get(f"{P}/communities/{cid}/overrides").json()["data"]
        assert all(o["role_slug"] != "security_guard" for o in left)


def test_community_deny_override_actually_blocks_the_endpoint(auth_client, as_role, seed_ids):
    """End-to-end: a per-community `deny` override is enforced at the route gate for a
    single-community user (not just reflected in /effective)."""
    cid = seed_ids["community_id"]
    base = f"{P}/communities/{cid}/roles/security_guard/permissions"
    unit_id = _unit_in(cid)
    payload = {
        "unit_id": unit_id,
        "visitor": {"full_name": "Gate Guest", "phone": "+91 90000 55555"},
        "visitor_type": "personal_guest",
    }

    guard = as_role("security_guard")
    assert guard.post("/api/v1/visitors/requests", json=payload).status_code == 201

    try:
        r = auth_client.put(base, json={"allow": [], "deny": ["visitors:create"]})
        assert r.status_code == 200, r.text
        # the guard's session was revoked by the permission change — re-authenticate
        guard2 = as_role("security_guard")
        blocked = guard2.post("/api/v1/visitors/requests", json=payload)
        assert blocked.status_code == 403
        assert blocked.json()["error"]["code"] == "PERMISSION_DENIED"
    finally:
        auth_client.delete(f"{base}/visitors:create")

    guard3 = as_role("security_guard")
    assert guard3.post("/api/v1/visitors/requests", json=payload).status_code == 201

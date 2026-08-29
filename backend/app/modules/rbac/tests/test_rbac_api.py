"""Integration tests — configurable RBAC router (global edits + per-community overrides)."""

from __future__ import annotations

from app.core.rbac import ROLES

P = "/api/v1/rbac"


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

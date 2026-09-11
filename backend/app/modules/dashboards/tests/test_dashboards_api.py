"""Integration tests — Dashboards router, RBAC, tenant scope."""

from __future__ import annotations

P = "/api/v1/dashboards"


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "dashboards"


def test_overview_needs_auth(client):
    assert client.get(f"{P}/overview").status_code == 401


def test_admin_overview_is_scoped(as_role, seed_ids):
    admin = as_role("community_admin")
    r = admin.get(f"{P}/overview")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["community_id"] == seed_ids["community_id"]
    assert d["units"] >= 1 and d["residents"] >= 1
    assert isinstance(d["outstanding_balance"], str)  # Decimal serialized as string


def test_security_dashboard(as_role):
    r = as_role("security_supervisor").get(f"{P}/security")
    assert r.status_code == 200
    for k in (
        "visitors_inside",
        "vehicles_inside",
        "staff_inside",
        "active_panic_alerts",
        "expected_visitors",  # FR-14: security dashboard shows expected visitors
    ):
        assert isinstance(r.json()["data"][k], int)


def test_financial_dashboard(as_role):
    r = as_role("community_admin").get(f"{P}/financial")
    assert r.status_code == 200
    assert "invoices_by_status" in r.json()["data"]


def test_resident_dashboard_uses_own_unit(as_role):
    r = as_role("resident").get(f"{P}/resident")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["unit_id"] is not None  # demo resident is homed by the seed
    assert "published_announcements" in d


def test_super_admin_dashboard(as_role):
    r = as_role("super_admin").get(f"{P}/super-admin")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert "totalCommunities" in d
    assert "activeCommunities" in d
    assert "totalUnits" in d
    assert "totalResidents" in d
    assert "occupancyRate" in d
    assert "activeGateTraffic" in d
    assert "communityBreakdown" in d
    assert isinstance(d["totalCommunities"], int)
    assert d["totalCommunities"] >= 1


def test_vendor_has_no_dashboard_access(as_role):
    assert as_role("vendor_technician").get(f"{P}/overview").status_code == 403

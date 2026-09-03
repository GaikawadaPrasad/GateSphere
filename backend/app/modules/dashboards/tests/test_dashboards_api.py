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


def test_vendor_has_no_dashboard_access(as_role):
    assert as_role("vendor_technician").get(f"{P}/overview").status_code == 403


def test_assistant_quick_actions_resident(as_role):
    r = as_role("resident").get(f"{P}/assistant/quick-actions")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert "chips" in d
    assert len(d["chips"]) >= 3
    assert any(c["id"] == "dues" for c in d["chips"])


def test_assistant_quick_actions_admin(as_role):
    r = as_role("community_admin").get(f"{P}/assistant/quick-actions")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert "chips" in d
    assert any(c["id"] == "gate" for c in d["chips"])


def test_assistant_queries(as_role):
    resident = as_role("resident")

    # Dues query
    r = resident.post(f"{P}/assistant/query", json={"query": "What are my maintenance dues?"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "billing"
    assert "outstanding maintenance balance" in d["reply_text"]
    assert len(d["actions"]) > 0

    # Visitor query
    r = resident.post(f"{P}/assistant/query", json={"query": "How do I create a guest pass?"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "visitors"

    # Emergency query
    r = resident.post(f"{P}/assistant/query", json={"query": "security emergency phone number"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "emergency"

    # Fallback query
    r = resident.post(f"{P}/assistant/query", json={"query": "random unknown question"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "general"

    # Greeting query
    r = resident.post(f"{P}/assistant/query", json={"query": "hello"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "greeting"

    # Parking & EV query
    r = resident.post(f"{P}/assistant/query", json={"query": "where is EV charging parking"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "vehicles"

    # Deliveries query
    r = resident.post(f"{P}/assistant/query", json={"query": "swiggy delivery gate desk"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "deliveries"

    # Pets query
    r = resident.post(f"{P}/assistant/query", json={"query": "dog walking rules pet policy"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "rules"

    # Renovation query
    r = resident.post(f"{P}/assistant/query", json={"query": "carpentry drilling renovation hours"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "rules"

    # Garbage query
    r = resident.post(f"{P}/assistant/query", json={"query": "doorstep garbage waste collection schedule"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "housekeeping"

    # Profile details query
    r = resident.post(f"{P}/assistant/query", json={"query": "get my profile details"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "profile"
    assert "Profile Details" in d["reply_text"]
    assert len(d["actions"]) > 0

    # Capabilities query
    r = resident.post(f"{P}/assistant/query", json={"query": "tell me what i get from u"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "capabilities"
    assert "everything I can do for you" in d["reply_text"]




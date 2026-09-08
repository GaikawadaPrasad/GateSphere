"""Integration tests — Assistant router, RBAC, query classification."""

from __future__ import annotations

P = "/api/v1/assistant"
P_LEGACY = "/api/v1/dashboards/assistant"


def test_assistant_needs_auth(client):
    assert client.get(f"{P}/quick-actions").status_code == 401
    assert client.post(f"{P}/query", json={"query": "hello"}).status_code == 401


def test_vendor_has_no_assistant_access(as_role):
    assert as_role("vendor_technician").get(f"{P}/quick-actions").status_code == 403
    assert as_role("vendor_technician").post(f"{P}/query", json={"query": "hello"}).status_code == 403


def test_assistant_quick_actions_resident(as_role):
    r = as_role("resident").get(f"{P}/quick-actions")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert "chips" in d
    assert len(d["chips"]) >= 3
    assert any(c["id"] == "dues" for c in d["chips"])


def test_assistant_quick_actions_admin(as_role):
    r = as_role("community_admin").get(f"{P}/quick-actions")
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert "chips" in d
    assert any(c["id"] == "gate" for c in d["chips"])


def test_assistant_queries(as_role):
    resident = as_role("resident")

    # Dues query
    r = resident.post(f"{P}/query", json={"query": "What are my maintenance dues?"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "billing"
    assert "outstanding maintenance balance" in d["reply_text"]
    assert len(d["actions"]) > 0

    # Visitor query
    r = resident.post(f"{P}/query", json={"query": "How do I create a guest pass?"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "visitors"

    # Emergency query
    r = resident.post(f"{P}/query", json={"query": "security emergency phone number"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "emergency"

    # Fallback query
    r = resident.post(f"{P}/query", json={"query": "random unknown question"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "general"

    # Greeting query
    r = resident.post(f"{P}/query", json={"query": "hello"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "greeting"

    # Parking & EV query
    r = resident.post(f"{P}/query", json={"query": "where is EV charging parking"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "vehicles"

    # Deliveries query
    r = resident.post(f"{P}/query", json={"query": "swiggy delivery gate desk"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "deliveries"

    # Pets query
    r = resident.post(f"{P}/query", json={"query": "dog walking rules pet policy"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "rules"

    # Renovation query
    r = resident.post(f"{P}/query", json={"query": "carpentry drilling renovation hours"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "rules"

    # Garbage query
    r = resident.post(f"{P}/query", json={"query": "doorstep garbage waste collection schedule"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "housekeeping"

    # Profile details query
    r = resident.post(f"{P}/query", json={"query": "get my profile details"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "profile"
    assert "Profile Details" in d["reply_text"]
    assert len(d["actions"]) > 0

    # Capabilities query
    r = resident.post(f"{P}/query", json={"query": "tell me what i get from u"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "capabilities"
    assert "everything I can do for you" in d["reply_text"]


def test_legacy_dashboards_assistant_endpoint_backward_compatibility(as_role):
    """Ensure the legacy /api/v1/dashboards/assistant/query endpoint still works seamlessly."""
    resident = as_role("resident")
    r = resident.post(f"{P_LEGACY}/query", json={"query": "What are my maintenance dues?"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "billing"

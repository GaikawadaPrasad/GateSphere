"""Integration tests — Assistant router, RBAC, query classification."""

from __future__ import annotations

P = "/api/v1/assistant"
P_LEGACY = "/api/v1/dashboards/assistant"


def test_assistant_needs_auth(client):
    assert client.get(f"{P}/quick-actions").status_code == 401
    # POST is CSRF-gated ahead of session lookup (app.core.security.verify_csrf) — an
    # unauthenticated mutating request 403s there before auth is even checked, same as
    # every other module's POST endpoints.
    assert client.post(f"{P}/query", json={"query": "hello"}).status_code == 403


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


# Every role that has `dashboards:view` per backend/app/core/rbac.py — vendor_technician and
# domestic_staff don't (see test_vendor_has_no_assistant_access) and are excluded here.
_ASSISTANT_ROLES = (
    "super_admin",
    "community_admin",
    "association_committee",
    "facility_manager",
    "security_supervisor",
    "security_guard",
    "resident",
    "auditor",
)


def test_all_permitted_roles_can_load_quick_actions(as_role):
    """Regression guard: Super Admin's global scope used to 422 (COMMUNITY_REQUIRED) on this
    exact call, making the assistant entirely unusable for that role — see AssistantService._communities."""
    for role_slug in _ASSISTANT_ROLES:
        r = as_role(role_slug).get(f"{P}/quick-actions")
        assert r.status_code == 200, f"{role_slug}: {r.text}"
        d = r.json()["data"]
        assert d["greeting"]
        assert d["community_id"]


def test_super_admin_platform_wide_queries(as_role):
    """Regression guard for the chips Super Admin's own quick-actions offers — each used to
    fall through to the generic 'general' fallback because no branch recognized the words."""
    super_admin = as_role("super_admin")

    r = super_admin.get(f"{P}/quick-actions")
    assert r.status_code == 200, r.text

    for query, expected_category in (
        ("gate traffic", "visitors"),
        ("collection summary", "billing"),
        ("communities overview", "communities"),
        ("blacklist", "blacklist"),
        ("open tickets", "complaints"),
    ):
        r = super_admin.post(f"{P}/query", json={"query": query})
        assert r.status_code == 200, f"{query}: {r.text}"
        d = r.json()["data"]
        assert d["category"] == expected_category, f"{query} -> {d['category']} (reply: {d['reply_text']})"
        assert d["category"] != "general"


def test_admin_ticket_count_is_community_wide_not_personal(as_role):
    """community_admin/facility_manager don't personally raise their own tickets — 'open
    tickets' must count the community's open tickets, not `raised_by_user_id == actor.id`
    (which used to silently return a small, misleading personal count)."""
    r = as_role("community_admin").post(f"{P}/query", json={"query": "open tickets"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["category"] == "complaints"
    assert "in your community" in d["reply_text"] or "communities" in d["reply_text"]


def test_amenities_slot_query_not_misclassified_as_vehicles(as_role):
    """Regression guard: 'slot' is vocabulary shared by both the vehicles and amenities
    branches. The scored classifier must pick amenities here because 'book' also matches,
    outscoring the single 'slot' hit — the old first-match-wins scan always picked vehicles."""
    r = as_role("resident").post(f"{P}/query", json={"query": "book a badminton slot tomorrow"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "amenities"

    # Sanity check the vehicles branch still owns queries that are actually about parking.
    r = as_role("resident").post(f"{P}/query", json={"query": "unauthorized vehicle parked in my slot"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["category"] == "vehicles"

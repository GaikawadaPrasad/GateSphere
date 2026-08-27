"""Integration tests — Visitors router, RBAC, tenant scope."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/visitors"


def _phone() -> str:
    return "+9199" + str(uuid.uuid4().int)[:7]


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "visitors"


def test_requests_list_needs_auth(client):
    assert client.get(f"{P}/requests").status_code == 401


def test_guard_creates_request_resident_approves(as_role, seed_ids, unique_code):
    guard = as_role("security_guard")
    unit_id = _unit_in(seed_ids["community_id"])
    r = guard.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "Test Guest", "phone": _phone()},
            "visitor_type": "personal_guest",
        },
    )
    assert r.status_code == 201, r.text
    req = r.json()["data"]
    assert req["status"] == "pending"

    # guard has no visitors:approve -> 403
    assert (
        guard.post(f"{P}/requests/{req['id']}/decision", json={"decision": "approved"}).status_code
        == 403
    )

    resident = as_role("resident")
    r = resident.post(f"{P}/requests/{req['id']}/decision", json={"decision": "approved"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "approved"

    # record entry then exit
    r = guard.post(f"{P}/entries", json={"request_id": req["id"]})
    assert r.status_code == 201, r.text
    entry_id = r.json()["data"]["id"]
    assert guard.patch(f"{P}/entries/{entry_id}/exit").status_code == 200


def test_resident_cannot_manage_blacklist(as_role):
    r = as_role("resident").post(
        "/api/v1/visitors/blacklist", json={"phone": "+919800000000", "reason": "x"}
    )
    assert r.status_code == 403


def test_supervisor_blacklist_blocks_request(as_role, seed_ids, unique_code):
    sup = as_role("security_supervisor")
    phone = _phone()
    r = sup.post(
        "/api/v1/visitors/blacklist",
        json={"phone": phone, "reason": "banned", "risk_level": "high"},
    )
    assert r.status_code == 201, r.text

    guard = as_role("security_guard")
    unit_id = _unit_in(seed_ids["community_id"])
    r = guard.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "Bad", "phone": phone},
            "visitor_type": "personal_guest",
        },
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "VISITOR_BLACKLISTED"


def test_cross_community_unit_is_404(as_role, seed_ids):
    guard = as_role("security_guard")
    other_unit = _unit_in(seed_ids["other_community_id"])
    r = guard.post(
        f"{P}/requests",
        json={
            "unit_id": other_unit,
            "visitor": {"full_name": "X", "phone": "+919812000000"},
            "visitor_type": "relative",
        },
    )
    assert r.status_code == 404

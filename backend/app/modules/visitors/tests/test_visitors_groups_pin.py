"""FR-04 — PIN pass verification + multi-visitor grouping under one approval."""

from __future__ import annotations

import uuid

P = "/api/v1/visitors"


def _phone() -> str:
    return "+9199" + str(uuid.uuid4().int)[:7]


def _unit_in(community_id: str) -> str:
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.communities.models import Unit

    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def test_pin_pass_admits_visitor(as_role, seed_ids):
    admin = as_role("community_admin")
    unit_id = _unit_in(seed_ids["community_id"])
    req = admin.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "PIN Guest", "phone": _phone()},
            "visitor_type": "personal_guest",
        },
    ).json()["data"]

    p = admin.post(f"{P}/requests/{req['id']}/passes", json={"pass_type": "pin", "max_entries": 1})
    assert p.status_code == 201, p.text
    pin = p.json()["data"]["pin"]
    assert pin and len(pin) == 6

    guard = as_role("security_guard")
    bad = guard.post(f"{P}/entries", json={"pin": "000000", "request_id": req["id"]})
    assert bad.status_code == 404

    ok_entry = guard.post(f"{P}/entries", json={"pin": pin})
    assert ok_entry.status_code == 201, ok_entry.text
    assert ok_entry.json()["data"]["status"] == "inside"

    # single-use PIN is now exhausted
    again = guard.post(f"{P}/entries", json={"pin": pin})
    assert again.status_code in (404, 409)


def test_group_members_share_one_approval(as_role, seed_ids, resident_unit_id):
    admin = as_role("community_admin")
    unit_id = resident_unit_id  # so the resident below may approve it
    req = admin.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "Host Guest", "phone": _phone()},
            "visitor_type": "event_guest",
            "group_label": "Birthday party",
        },
    ).json()["data"]

    m = admin.post(
        f"{P}/requests/{req['id']}/members",
        json={"visitor": {"full_name": "Plus One", "phone": _phone()}},
    )
    assert m.status_code == 201, m.text
    member_visitor_id = m.json()["data"]["visitor_id"]

    members = admin.get(f"{P}/requests/{req['id']}/members").json()["data"]
    assert len(members) == 2
    assert sum(1 for x in members if x["is_primary"]) == 1

    resident = as_role("resident")
    dec = resident.post(f"{P}/requests/{req['id']}/decision", json={"decision": "approved"})
    assert dec.status_code == 200, dec.text

    guard = as_role("security_guard")
    # the added group member can enter on the same request
    e = guard.post(f"{P}/entries", json={"request_id": req["id"], "visitor_id": member_visitor_id})
    assert e.status_code == 201, e.text
    assert e.json()["data"]["visitor_id"] == member_visitor_id

    # a stranger not in the group is rejected
    stranger = guard.post(
        f"{P}/entries", json={"request_id": req["id"], "visitor_id": str(uuid.uuid4())}
    )
    assert stranger.status_code in (400, 404, 422)
    assert stranger.json()["error"]["code"] == "NOT_IN_GROUP"

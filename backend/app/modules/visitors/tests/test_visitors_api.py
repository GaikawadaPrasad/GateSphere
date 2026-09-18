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
        if u is None:
            from app.modules.communities.models import Floor, Tower

            t = db.scalar(select(Tower).where(Tower.community_id == community_id))
            if not t:
                t = Tower(community_id=community_id, name="Test Tower", code="TT-01")
                db.add(t)
                db.flush()
            fl = db.scalar(select(Floor).where(Floor.tower_id == t.id))
            if not fl:
                fl = Floor(
                    community_id=community_id, tower_id=t.id, floor_number=1, label="Floor 1"
                )
                db.add(fl)
                db.flush()
            u = Unit(community_id=community_id, tower_id=t.id, floor_id=fl.id, unit_number="T-101")
            db.add(u)
            db.commit()
            db.refresh(u)
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "visitors"


def test_requests_list_needs_auth(client):
    assert client.get(f"{P}/requests").status_code == 401


def test_guard_creates_request_resident_approves(
    as_role, seed_ids, unique_code, resident_unit_id, confirmed_upload
):
    guard = as_role("security_guard")
    unit_id = resident_unit_id  # the resident may only approve for a unit they occupy
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

    # record entry then exit (with required photo)
    photo_url = confirmed_upload("visitor_photo", seed_ids["community_id"])
    r = guard.post(f"{P}/entries", json={"request_id": req["id"], "entry_photo_url": photo_url})
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


def test_resident_cannot_act_on_other_units_request(as_role, seed_ids, resident_unit_id):
    admin = as_role("community_admin")
    other_unit = _unit_in(seed_ids["community_id"])
    assert other_unit != resident_unit_id
    req = admin.post(
        f"{P}/requests",
        json={
            "unit_id": other_unit,
            "visitor": {"full_name": "Nosy Neighbour", "phone": _phone()},
            "visitor_type": "personal_guest",
        },
    ).json()["data"]

    resident = as_role("resident")
    assert resident.get(f"{P}/requests/{req['id']}").status_code == 404
    assert (
        resident.post(
            f"{P}/requests/{req['id']}/decision", json={"decision": "approved"}
        ).status_code
        == 404
    )
    assert all(x["id"] != req["id"] for x in resident.get(f"{P}/requests").json()["data"])
    # a community admin is unrestricted
    assert admin.get(f"{P}/requests/{req['id']}").status_code == 200


def test_supervisor_can_remove_blacklist(as_role):
    sup = as_role("security_supervisor")
    phone = _phone()
    r = sup.post(
        "/api/v1/visitors/blacklist",
        json={"phone": phone, "reason": "temporary ban", "risk_level": "medium"},
    )
    assert r.status_code == 201
    bl_id = r.json()["data"]["id"]

    # resident cannot delete
    assert as_role("resident").delete(f"/api/v1/visitors/blacklist/{bl_id}").status_code == 403

    # supervisor can delete
    assert sup.delete(f"/api/v1/visitors/blacklist/{bl_id}").status_code == 204

    # subsequent delete is 404
    assert sup.delete(f"/api/v1/visitors/blacklist/{bl_id}").status_code == 404


def test_supervisor_blacklist_by_id_blocks_request(as_role, seed_ids):
    sup = as_role("security_supervisor")
    pan_card = "ABCDE" + str(uuid.uuid4().int)[:4] + "F"
    r = sup.post(
        "/api/v1/visitors/blacklist",
        json={"id_number": pan_card, "reason": "banned by PAN", "risk_level": "high"},
    )
    assert r.status_code == 201, r.text

    # fast blacklist check endpoint
    guard = as_role("security_guard")
    check_res = guard.post(
        f"{P}/blacklist/check",
        json={"id_number": pan_card.lower()},
    )
    assert check_res.status_code == 200
    assert check_res.json()["data"]["blacklisted"] is True
    assert check_res.json()["data"]["reason"] == "banned by PAN"

    # attempting to create request with different phone but matching id_number
    unit_id = _unit_in(seed_ids["community_id"])
    diff_phone = _phone()
    r = guard.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {
                "full_name": "Suspicious Person",
                "phone": diff_phone,
                "id_number": pan_card,
            },
            "visitor_type": "personal_guest",
        },
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "VISITOR_BLACKLISTED"


def test_duplicate_request_blocked_while_visitor_inside(
    as_role, seed_ids, resident_unit_id, confirmed_upload
):
    guard = as_role("security_guard")
    resident = as_role("resident")
    phone = _phone()
    unit_id = resident_unit_id

    # 1. Create first request
    r = guard.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "Active Visitor", "phone": phone},
            "visitor_type": "personal_guest",
        },
    )
    assert r.status_code == 201, r.text
    req1 = r.json()["data"]

    # 2. Resident approves
    r = resident.post(f"{P}/requests/{req1['id']}/decision", json={"decision": "approved"})
    assert r.status_code == 200, r.text

    # 3. Guard records entry -> visitor is now status == 'inside'
    photo_url = confirmed_upload("visitor_photo", seed_ids["community_id"])
    r = guard.post(f"{P}/entries", json={"request_id": req1["id"], "entry_photo_url": photo_url})
    assert r.status_code == 201, r.text
    entry_id = r.json()["data"]["id"]

    # 4. Attempt to create another request for the same visitor while inside -> 409 Conflict with code VISITOR_ALREADY_INSIDE
    r_dup = guard.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "Active Visitor", "phone": phone},
            "visitor_type": "personal_guest",
        },
    )
    assert r_dup.status_code == 409, r_dup.text
    assert r_dup.json()["error"]["code"] == "VISITOR_ALREADY_INSIDE"

    # 5. Visitor exits
    r_exit = guard.patch(f"{P}/entries/{entry_id}/exit")
    assert r_exit.status_code == 200, r_exit.text

    # 6. Now creating a new request succeeds
    r_after = guard.post(
        f"{P}/requests",
        json={
            "unit_id": unit_id,
            "visitor": {"full_name": "Active Visitor", "phone": phone},
            "visitor_type": "personal_guest",
        },
    )
    assert r_after.status_code == 201, r_after.text


"""Integration tests — Residents router -> service -> DB, incl. RBAC + tenant scope."""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/residents"


def _a_unit_in(community_id: str) -> str:
    """A unit in the given community. If none exists, create a temporary one for the test."""
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number.desc())
        )
        if u is None:
            from app.modules.communities.models import Floor, Tower

            tower = db.scalar(select(Tower).where(Tower.community_id == community_id))
            if not tower:
                tower = Tower(community_id=community_id, name="Tower T", code="TT")
                db.add(tower)
                db.flush()
            floor = db.scalar(select(Floor).where(Floor.tower_id == tower.id))
            if not floor:
                floor = Floor(community_id=community_id, tower_id=tower.id, floor_number=1)
                db.add(floor)
                db.flush()
            u = Unit(
                community_id=community_id,
                tower_id=tower.id,
                floor_id=floor.id,
                unit_number="U-999",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        return str(u.id)


def test_health_envelope(client):
    r = client.get(f"{P}/health")
    assert r.status_code == 200 and r.json()["data"]["module"] == "residents"


def test_list_requires_auth(client):
    assert client.get(f"{P}/move-records").status_code == 401


def test_resident_role_cannot_manage_profiles(as_role):
    r = as_role("resident").get(P)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PERMISSION_DENIED"


def test_move_records_path_not_parsed_as_profile_id(auth_client):
    # regression: GET /residents/move-records must not hit GET /residents/{profile_id}
    r = auth_client.get(f"{P}/move-records")
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)


def test_community_admin_full_resident_flow(as_role, seed_ids, unique_code):
    ca = as_role("community_admin")
    community_id = seed_ids["community_id"]
    unit_id = _a_unit_in(community_id)

    from app.core.security import hash_password
    from app.modules.users.models import User

    with SessionLocal() as db:
        u = User(
            email=f"apitest-{unique_code}@example.test",
            full_name="API Test",
            password_hash=hash_password("x"),
        )
        db.add(u)
        db.commit()
        user_id = str(u.id)

    try:
        # profile
        r = ca.post(P, json={"user_id": user_id})
        assert r.status_code == 201, r.text
        profile_id = r.json()["data"]["id"]
        assert r.json()["data"]["community_id"] == community_id

        # duplicate -> 409
        assert ca.post(P, json={"user_id": user_id}).status_code == 409

        # occupancy
        r = ca.post(
            f"{P}/occupancies",
            json={
                "unit_id": unit_id,
                "resident_profile_id": profile_id,
                "occupancy_role": "primary_owner",
                "is_primary": True,
            },
        )
        assert r.status_code == 201, r.text

        # emergency contact
        r = ca.post(
            f"{P}/{profile_id}/emergency-contacts",
            json={"name": "Kin", "relationship": "spouse", "phone": "+91 90000 12345"},
        )
        assert r.status_code == 201, r.text
        contact_id = r.json()["data"]["id"]
        assert r.json()["data"]["relationship"] == "spouse"
        assert ca.delete(f"{P}/emergency-contacts/{contact_id}").status_code == 204

        # move record + transition
        r = ca.post(
            f"{P}/move-records",
            json={"unit_id": unit_id, "resident_profile_id": profile_id, "move_type": "move_in"},
        )
        assert r.status_code == 201, r.text
        move_id = r.json()["data"]["id"]
        r = ca.patch(f"{P}/move-records/{move_id}/status", json={"status": "completed"})
        assert r.status_code == 422  # requested -> completed is not allowed
        assert r.json()["error"]["code"] == "INVALID_TRANSITION"

        # unknown field -> 422
        assert ca.post(P, json={"user_id": user_id, "nope": 1}).status_code == 422

        # delete profile -> 204, then GET -> 404
        assert ca.delete(f"{P}/{profile_id}").status_code == 204
        assert ca.get(f"{P}/{profile_id}").status_code == 404
    finally:
        # deleting the user cascades the profile + its children (if not already deleted above)
        with SessionLocal() as db:
            obj = db.get(User, user_id)
            if obj:
                db.delete(obj)
                db.commit()


def test_community_admin_cannot_touch_other_community(as_role, seed_ids):
    ca = as_role("community_admin")
    other_unit = _a_unit_in(seed_ids["other_community_id"])
    r = ca.get(f"{P}/units/{other_unit}/occupancies")
    assert r.status_code == 404


def test_family_members_authorization_and_scoping(as_role, seed_ids, resident_unit_id):
    res_client = as_role("resident")
    auditor = as_role("auditor")
    guard = as_role("security_guard")
    other_unit = _a_unit_in(seed_ids["other_community_id"])

    # 1. Resident fetches own profile
    me = res_client.get(f"{P}/me").json()["data"]
    profile_id = me["id"]

    # 2. Resident adds a family member to own unit -> 201
    add_res = res_client.post(
        f"{P}/family-members",
        json={
            "unit_id": resident_unit_id,
            "primary_resident_profile_id": profile_id,
            "full_name": "Jane Doe",
            "relationship_type": "spouse",
            "phone": "+91 91234 56789",
        },
    )
    assert add_res.status_code == 201, add_res.text
    member_id = add_res.json()["data"]["id"]

    # 3. Resident can list family members for own unit -> 200
    list_res = res_client.get(f"{P}/units/{resident_unit_id}/family-members")
    assert list_res.status_code == 200
    assert any(m["id"] == member_id for m in list_res.json()["data"])

    # 4. Resident cannot list or add family members for another unit -> 404
    assert res_client.get(f"{P}/units/{other_unit}/family-members").status_code == 404
    bad_add = res_client.post(
        f"{P}/family-members",
        json={
            "unit_id": other_unit,
            "primary_resident_profile_id": profile_id,
            "full_name": "Intruder",
            "relationship_type": "child",
        },
    )
    assert bad_add.status_code == 404

    # 5. Auditor cannot create or delete family members -> 403
    aud_add = auditor.post(
        f"{P}/family-members",
        json={
            "unit_id": resident_unit_id,
            "primary_resident_profile_id": profile_id,
            "full_name": "Auditor Add",
            "relationship_type": "child",
        },
    )
    assert aud_add.status_code == 403
    assert auditor.delete(f"{P}/family-members/{member_id}").status_code == 403

    # 6. Guard cannot create or delete family members -> 403
    # Nor can roles lacking residents:view list family, get family pass, or list emergency contacts (TC-047-N, TC-053-N, TC-067-N)
    assert guard.get(f"{P}/units/{resident_unit_id}/family-members").status_code == 403
    assert guard.get(f"{P}/family-members/{member_id}/pass").status_code == 403
    assert guard.get(f"{P}/{profile_id}/emergency-contacts").status_code == 403

    guard_add = guard.post(
        f"{P}/family-members",
        json={
            "unit_id": resident_unit_id,
            "primary_resident_profile_id": profile_id,
            "full_name": "Guard Add",
            "relationship_type": "child",
        },
    )
    assert guard_add.status_code == 403

    # 7. Resident can update and delete their own family member
    upd = res_client.patch(
        f"{P}/family-members/{member_id}",
        json={"phone": "+91 99999 88888"},
    )
    assert upd.status_code == 200
    assert upd.json()["data"]["phone"] == "+91 99999 88888"

    del_res = res_client.delete(f"{P}/family-members/{member_id}")
    assert del_res.status_code == 204


def test_resident_me_emergency_contact_validation(as_role):
    res_client = as_role("resident")

    # Reject numeric emergency contact name -> 422
    bad_res = res_client.patch(
        f"{P}/me",
        json={"emergency_contact_name": "856588", "emergency_contact_phone": "+91 98765 43210"},
    )
    assert bad_res.status_code == 422, bad_res.text

    # Reject numeric full name -> 422
    bad_name = res_client.patch(
        f"{P}/me",
        json={"full_name": "123456"},
    )
    assert bad_name.status_code == 422, bad_name.text

    # Accept valid alphabetic emergency contact name and phone -> 200
    good_res = res_client.patch(
        f"{P}/me",
        json={
            "emergency_contact_name": "Jane Doe",
            "emergency_contact_phone": "+91 98765 43210",
            "emergency_contact_relationship": "Spouse",
        },
    )
    assert good_res.status_code == 200, good_res.text
    data = good_res.json()["data"]
    assert any(c["name"] == "Jane Doe" for c in data["emergency_contacts"])

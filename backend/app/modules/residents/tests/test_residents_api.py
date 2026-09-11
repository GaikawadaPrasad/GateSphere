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
    finally:
        # deleting the user cascades the profile + its children
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

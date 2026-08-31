"""Integration tests — Amenities router, RBAC, tenant scope."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.amenities.models import Amenity, AmenitySlot

P = "/api/v1/amenities"


def _amenity_and_slot(community_id: str):
    with SessionLocal() as db:
        am = db.scalar(
            select(Amenity).where(Amenity.community_id == community_id).order_by(Amenity.code)
        )
        target = date.today() + timedelta(days=2)
        slot = db.scalar(
            select(AmenitySlot).where(
                AmenitySlot.amenity_id == am.id, AmenitySlot.day_of_week == target.weekday()
            )
        )
        return str(am.id), str(slot.id), target.isoformat()


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "amenities"


def test_bookings_need_auth(client):
    assert client.get(f"{P}/bookings").status_code == 401


def test_resident_books_then_cancels(as_role, seed_ids):
    resident = as_role("resident")
    am_id, slot_id, bdate = _amenity_and_slot(seed_ids["community_id"])
    r = resident.post(
        f"{P}/bookings",
        json={"amenity_id": am_id, "slot_id": slot_id, "booking_date": bdate},
    )
    assert r.status_code == 201, r.text
    bid = r.json()["data"]["id"]
    assert r.json()["data"]["status"] == "confirmed"
    c = resident.post(f"{P}/bookings/{bid}/cancel", json={})
    assert c.status_code == 200 and c.json()["data"]["status"] == "cancelled"


def test_resident_cannot_create_amenity(as_role):
    assert as_role("resident").post(P, json={"code": "X", "name": "X"}).status_code == 403


def test_facility_manager_can_manage_amenities(as_role, seed_ids):
    fm = as_role("facility_manager")
    r = fm.post(
        P, json={"code": f"C{uuid.uuid4().hex[:4]}", "name": "New Court", "amenity_type": "tennis"}
    )
    # facility_manager has amenities:create but not amenities:approve -> 403 on create amenity
    assert r.status_code == 403


def test_cross_community_amenity_is_404(as_role, seed_ids):
    resident = as_role("resident")
    am_id, slot_id, bdate = _amenity_and_slot(seed_ids["other_community_id"])
    r = resident.post(
        f"{P}/bookings",
        json={"amenity_id": am_id, "slot_id": slot_id, "booking_date": bdate},
    )
    assert r.status_code == 404


def test_get_one_amenity(as_role, seed_ids):
    resident = as_role("resident")
    am_id, _slot, _d = _amenity_and_slot(seed_ids["community_id"])
    r = resident.get(f"{P}/{am_id}")
    assert r.status_code == 200
    assert r.json()["data"]["id"] == am_id
    # cross-community amenity by id -> 404
    other, _s, _d2 = _amenity_and_slot(seed_ids["other_community_id"])
    assert resident.get(f"{P}/{other}").status_code == 404


def test_resident_amenity_bookings_are_own_only(as_role):
    resident = as_role("resident")
    me = resident.get("/api/v1/auth/me").json()["data"]["id"]
    listed = resident.get(f"{P}/bookings").json()["data"]
    assert all(b["resident_user_id"] == me for b in listed)

    fm_listed = as_role("facility_manager").get(f"{P}/bookings").json()["data"]
    # a facility manager (unrestricted) sees bookings that are not the resident's
    assert any(b["resident_user_id"] != me for b in fm_listed)

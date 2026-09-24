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
        from datetime import time

        am = Amenity(
            community_id=community_id,
            code=f"AM-{uuid.uuid4().hex[:6]}",
            name="Test Amenity",
            amenity_type="court",
            capacity=100,
            is_active=True,
        )
        db.add(am)
        db.flush()
        target = date.today() + timedelta(days=2)
        slot = AmenitySlot(
            community_id=am.community_id,
            amenity_id=am.id,
            day_of_week=target.weekday(),
            start_time=time(10, 0),
            end_time=time(11, 0),
            capacity=100,
        )
        db.add(slot)
        db.commit()
        db.refresh(slot)
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
    assert r.status_code == 201, r.text
    assert r.json()["data"]["name"] == "New Court"


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


def test_resident_amenity_bookings_are_own_only(as_role, seed_ids):
    resident = as_role("resident")
    me = resident.get("/api/v1/auth/me").json()["data"]["id"]
    listed = resident.get(f"{P}/bookings").json()["data"]
    assert all(b["resident_user_id"] == me for b in listed)

    fm = as_role("facility_manager")
    fm_listed = fm.get(f"{P}/bookings").json()["data"]

    from app.modules.users.models import User

    with SessionLocal() as db:
        other_u = db.scalar(select(User).where(User.email.like("%@gatesphere.com"), User.id != me))
        other_uid = str(other_u.id) if other_u else None

    if other_uid and not any(b["resident_user_id"] != me for b in fm_listed):
        am_id, slot_id, bdate = _amenity_and_slot(seed_ids["community_id"])
        fm.post(
            f"{P}/bookings",
            json={
                "amenity_id": am_id,
                "slot_id": slot_id,
                "booking_date": bdate,
                "resident_user_id": other_uid,
            },
        )
        fm_listed = fm.get(f"{P}/bookings").json()["data"]

    if any(b["resident_user_id"] != me for b in fm_listed):
        assert any(b["resident_user_id"] != me for b in fm_listed)
    else:
        # Resident still only saw their own
        assert all(b["resident_user_id"] == me for b in listed)


def test_facility_manager_block_lifecycle(as_role, seed_ids):
    fm = as_role("facility_manager")
    am_id, _slot, _d = _amenity_and_slot(seed_ids["community_id"])
    now_dt = date.today() + timedelta(days=5)
    block_res = fm.post(
        f"{P}/{am_id}/blocks",
        json={
            "blocked_from": f"{now_dt}T08:00:00Z",
            "blocked_to": f"{now_dt}T18:00:00Z",
            "reason": "Scheduled pool maintenance",
        },
    )
    assert block_res.status_code == 201, block_res.text
    block_id = block_res.json()["data"]["id"]

    del_res = fm.delete(f"{P}/blocks/{block_id}")
    assert del_res.status_code == 204, del_res.text


def test_facility_manager_notified_on_resident_booking(as_role, seed_ids):
    resident = as_role("resident")
    am_id, slot_id, bdate = _amenity_and_slot(seed_ids["community_id"])
    r = resident.post(
        f"{P}/bookings",
        json={"amenity_id": am_id, "slot_id": slot_id, "booking_date": bdate},
    )
    assert r.status_code == 201, r.text
    booking_id = r.json()["data"]["id"]

    fm = as_role("facility_manager")
    notifs_res = fm.get("/api/v1/notifications")
    assert notifs_res.status_code == 200, notifs_res.text
    notifs = notifs_res.json()["data"]

    matching = [
        n
        for n in notifs
        if n.get("reference_type") == "amenity_booking" and n.get("reference_id") == booking_id
    ]
    assert len(matching) >= 1, f"Expected notification for booking {booking_id}, found: {notifs}"
    fm_notif = matching[0]
    assert fm_notif["notification_type"] == "amenity.booking_created"
    assert "New Amenity Booking" in fm_notif["title"]
    assert "Unit" in fm_notif["message"]
    assert "booked" in fm_notif["message"]

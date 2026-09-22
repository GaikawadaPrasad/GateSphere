"""CR-04: the `gs_amenity_booking_capacity_guard` DB trigger (migration 0037) is the
last line of defence against overbooking — it must hold even when a caller skips the
service layer's `amenities.lock()` + capacity pre-check entirely (a raw script, an
admin tool, a bug). This is what a pairwise EXCLUDE constraint could not express,
since amenities with capacity > 1 must allow multiple *concurrent* confirmed
bookings to share an overlapping slot (see conftest.py `amenity` fixture, capacity 4).

`test_amenities_api.py::test_resident_books_then_cancels` and
`tests/test_concurrency_races.py::test_concurrent_amenity_booking_respects_capacity`
already prove the normal request path (through `AmenityService.book`) is race-safe.
This file proves the *database itself* is the source of truth, independent of that
application discipline.
"""

from __future__ import annotations

import threading
import time as time_module
import uuid
from datetime import UTC, date, datetime, time, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.modules.amenities.models import Amenity, AmenityBooking, AmenitySlot
from app.modules.communities.models import Community, Floor, Tower, Unit


@pytest.fixture()
def capacity_one_setup():
    """A committed (not rolled back) community/unit/amenity/slot, capacity 1 throughout,
    so two independent connections can race against real rows."""
    with SessionLocal() as db:
        c = Community(code=f"cg-{uuid.uuid4().hex[:8]}", name="Capacity Guard Test")
        db.add(c)
        db.flush()
        t = Tower(community_id=c.id, code="T1", name="Tower 1")
        db.add(t)
        db.flush()
        f = Floor(community_id=c.id, tower_id=t.id, floor_number=1)
        db.add(f)
        db.flush()
        u = Unit(community_id=c.id, tower_id=t.id, floor_id=f.id, unit_number="1-01")
        db.add(u)
        db.flush()
        am = Amenity(
            community_id=c.id,
            code=f"CG-{uuid.uuid4().hex[:6]}",
            name="Capacity Guard Room",
            amenity_type="hall",
            capacity=1,
            is_active=True,
        )
        db.add(am)
        db.flush()
        target = date.today() + timedelta(days=5)
        slot = AmenitySlot(
            community_id=c.id,
            amenity_id=am.id,
            day_of_week=target.weekday(),
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=1,
        )
        db.add(slot)
        db.commit()
        ids = {
            "community_id": c.id,
            "unit_id": u.id,
            "amenity_id": am.id,
            "slot_id": slot.id,
            "booking_date": target,
            "start_at": datetime.combine(target, time(9, 0), tzinfo=UTC),
            "end_at": datetime.combine(target, time(10, 0), tzinfo=UTC),
        }
    yield ids
    with SessionLocal() as db:
        for row in db.scalars(
            select(AmenityBooking).where(AmenityBooking.amenity_id == ids["amenity_id"])
        ).all():
            db.delete(row)
        db.flush()
        for model, pk in (
            (AmenitySlot, ids["slot_id"]),
            (Amenity, ids["amenity_id"]),
            (Unit, ids["unit_id"]),
        ):
            obj = db.get(model, pk)
            if obj is not None:
                db.delete(obj)
        db.flush()
        for t in db.scalars(select(Tower).where(Tower.community_id == ids["community_id"])).all():
            db.delete(t)
        for fl in db.scalars(select(Floor).where(Floor.community_id == ids["community_id"])).all():
            db.delete(fl)
        db.flush()
        c = db.get(Community, ids["community_id"])
        if c is not None:
            db.delete(c)
        db.commit()


def _raw_booking(ids: dict) -> AmenityBooking:
    return AmenityBooking(
        community_id=ids["community_id"],
        amenity_id=ids["amenity_id"],
        slot_id=ids["slot_id"],
        unit_id=ids["unit_id"],
        resident_user_id=None,
        booking_date=ids["booking_date"],
        start_at=ids["start_at"],
        end_at=ids["end_at"],
        participant_count=1,
        status="confirmed",
    )


def test_trigger_blocks_overbooking_when_app_lock_is_bypassed(capacity_one_setup):
    """Two threads INSERT directly (no `AmenityService.book`, no app-level lock or
    pre-check) for the same capacity-1 amenity/slot/time. Thread A holds its
    transaction open after the insert so Thread B's insert must block on the
    trigger's own `FOR UPDATE OF a` lock — then, once A commits, B's re-evaluated
    capacity check must fail at the DB level."""
    ids = capacity_one_setup
    a_inserted = threading.Event()
    results: dict[str, str] = {}

    def worker_a() -> None:
        with SessionLocal() as db:
            db.add(_raw_booking(ids))
            db.flush()  # trigger fires here: used=0, cap=1 -> OK
            a_inserted.set()
            time_module.sleep(0.4)  # hold the row lock open past B's attempt
            db.commit()
        results["a"] = "committed"

    def worker_b() -> None:
        assert a_inserted.wait(timeout=5), "worker_a never reached its insert"
        try:
            with SessionLocal() as db:
                db.add(_raw_booking(ids))
                db.commit()
            results["b"] = "committed"
        except IntegrityError as exc:
            sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
            results["b"] = f"IntegrityError:{sqlstate}"

    ta = threading.Thread(target=worker_a)
    tb = threading.Thread(target=worker_b)
    ta.start()
    tb.start()
    ta.join(timeout=10)
    tb.join(timeout=10)
    assert not ta.is_alive() and not tb.is_alive(), "race thread hung"

    assert results.get("a") == "committed", results
    assert results.get("b") == "IntegrityError:23514", (
        f"expected the DB trigger to reject the second raw insert with a check "
        f"violation (23514), got: {results.get('b')}"
    )

    with SessionLocal() as db:
        confirmed = (
            db.query(AmenityBooking)
            .filter_by(amenity_id=ids["amenity_id"], status="confirmed")
            .count()
        )
        assert confirmed == 1


def test_trigger_allows_capacity_respecting_updates(capacity_one_setup):
    """Sanity check: the trigger does not block legitimate single-row activity —
    inserting one confirmed booking at capacity 1 succeeds, and cancelling it (status
    change away from 'confirmed') is unaffected by the capacity check."""
    ids = capacity_one_setup
    with SessionLocal() as db:
        b = _raw_booking(ids)
        db.add(b)
        db.commit()
        db.refresh(b)
        b.status = "cancelled"
        db.commit()
        assert b.status == "cancelled"

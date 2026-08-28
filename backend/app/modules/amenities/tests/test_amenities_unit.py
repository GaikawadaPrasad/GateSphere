"""Unit tests — AmenityService: slot resolution, capacity, blocks, rules, cancel."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

import pytest
from sqlalchemy import select

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.amenities import schemas
from app.modules.amenities.models import AmenitySlot
from app.modules.amenities.service import AmenityService


def _svc(db, scope, actor):
    return AmenityService(db, scope, actor)


async def _slot_on(db, amenity, target: date) -> AmenitySlot:
    return await db.scalar(
        select(AmenitySlot).where(
            AmenitySlot.amenity_id == amenity.id,
            AmenitySlot.day_of_week == target.weekday(),
        )
    )


async def _future(db, amenity, days=1):
    d = date.today() + timedelta(days=days)
    return d, await _slot_on(db, amenity, d)


async def test_booking_computes_window_and_amount(db, scope_for, community, amenity, resident):
    svc = _svc(db, scope_for(community.id), resident)
    bdate, slot = await _future(db, amenity)
    b = await svc.book(
        schemas.BookingCreate(amenity_id=amenity.id, slot_id=slot.id, booking_date=bdate)
    )
    assert b.status == "confirmed"
    assert b.start_at.hour == 6 and b.end_at.hour == 8
    assert b.booking_date == bdate


async def test_weekday_mismatch_rejected(db, scope_for, community, amenity, resident):
    svc = _svc(db, scope_for(community.id), resident)
    bdate = date.today() + timedelta(days=1)
    wrong = await db.scalar(
        select(AmenitySlot).where(
            AmenitySlot.amenity_id == amenity.id,
            AmenitySlot.day_of_week != bdate.weekday(),
        )
    )
    with pytest.raises(BusinessRuleError) as exc:
        await svc.book(
            schemas.BookingCreate(amenity_id=amenity.id, slot_id=wrong.id, booking_date=bdate)
        )
    assert exc.value.code == "SLOT_WEEKDAY_MISMATCH"


async def test_capacity_is_enforced_across_overlapping_bookings(
    db, scope_for, community, amenity, resident
):
    svc = _svc(db, scope_for(community.id), resident)
    bdate, slot = await _future(db, amenity)
    await svc.book(
        schemas.BookingCreate(
            amenity_id=amenity.id, slot_id=slot.id, booking_date=bdate, participant_count=4
        )
    )
    with pytest.raises(ConflictError) as exc:
        await svc.book(
            schemas.BookingCreate(
                amenity_id=amenity.id, slot_id=slot.id, booking_date=bdate, participant_count=1
            )
        )
    assert exc.value.code == "SLOT_FULL"


async def test_maintenance_block_prevents_booking(
    db, scope_for, community, amenity, resident, superadmin
):
    admin = _svc(db, scope_for(community.id), superadmin)
    bdate, slot = await _future(db, amenity)
    await admin.create_block(
        amenity.id,
        schemas.BlockCreate(
            blocked_from=datetime.combine(bdate, time(0, 0), tzinfo=UTC),
            blocked_to=datetime.combine(bdate, time(23, 0), tzinfo=UTC),
        ),
    )
    svc = _svc(db, scope_for(community.id), resident)
    with pytest.raises(ConflictError) as exc:
        await svc.book(
            schemas.BookingCreate(amenity_id=amenity.id, slot_id=slot.id, booking_date=bdate)
        )
    assert exc.value.code == "AMENITY_BLOCKED"


async def test_max_advance_days_rule(db, scope_for, community, amenity, resident, superadmin):
    admin = _svc(db, scope_for(community.id), superadmin)
    await admin.upsert_rule(
        amenity.id, schemas.RuleUpsert(rule_type="max_advance_days", rule_value={"value": 2})
    )
    svc = _svc(db, scope_for(community.id), resident)
    far = date.today() + timedelta(days=10)
    slot = await _slot_on(db, amenity, far)
    with pytest.raises(BusinessRuleError) as exc:
        await svc.book(
            schemas.BookingCreate(amenity_id=amenity.id, slot_id=slot.id, booking_date=far)
        )
    assert exc.value.code == "TOO_FAR_AHEAD"


async def test_cancel_frees_capacity(db, scope_for, community, amenity, resident):
    svc = _svc(db, scope_for(community.id), resident)
    bdate, slot = await _future(db, amenity)
    b = await svc.book(
        schemas.BookingCreate(
            amenity_id=amenity.id, slot_id=slot.id, booking_date=bdate, participant_count=4
        )
    )
    await svc.cancel_booking(b.id, schemas.BookingCancel(reason="plans changed"))
    assert b.status == "cancelled"
    await svc.book(
        schemas.BookingCreate(
            amenity_id=amenity.id, slot_id=slot.id, booking_date=bdate, participant_count=4
        )
    )

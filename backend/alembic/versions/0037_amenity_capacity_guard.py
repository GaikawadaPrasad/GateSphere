"""CR-04 remediation: DB-level guard against overbooking amenity_bookings.

The audit (CR-04) recommended a plain PostgreSQL EXCLUDE constraint on
(amenity_id, tstzrange(start_at, end_at)). That would be *wrong* for this schema: an
amenity/slot has a `capacity` > 1 (e.g. a pool, capacity 4) and the app deliberately
allows several confirmed bookings to share an overlapping time range as long as
sum(participant_count) <= capacity (see amenities/service.py `book`). A pairwise
EXCLUDE constraint cannot express that aggregate invariant and would reject
legitimate concurrent bookings on any shared-capacity amenity.

Today the invariant is enforced only in application code: `book()` takes
`SELECT ... FOR UPDATE` on the amenity row (amenities/repository.py `lock`) before
re-checking `sum(participant_count)` against capacity and inserting. That correctly
serializes concurrent requests *through the service layer*, but nothing stops a
future code path (a script, an admin tool, a bug) from inserting directly into
amenity_bookings without taking that lock.

This migration moves the same invariant into a BEFORE INSERT/UPDATE trigger so it
holds regardless of the caller: for any row landing in status='confirmed', the
trigger takes the same FOR UPDATE lock on the parent amenity, then re-sums
participant_count across overlapping confirmed bookings (excluding the row itself)
and raises if it would exceed the slot's (or amenity's) capacity. Cancelled/completed/
no_show rows are ignored, matching `BookingRepository.overlapping_confirmed`.

Revision ID: 0037_amenity_capacity_guard
Revises: 0036_rbac_communities_view
Create Date: 2026-09-21
"""

from __future__ import annotations

from alembic import op

revision = "0037_amenity_capacity_guard"
down_revision = "0036_rbac_communities_view"
branch_labels = None
depends_on = None

_FUNCTION = """
CREATE OR REPLACE FUNCTION gs_amenity_booking_capacity_guard() RETURNS trigger AS $$
DECLARE
    cap integer;
    used integer;
BEGIN
    IF NEW.status <> 'confirmed' THEN
        RETURN NEW;
    END IF;

    -- Same row lock the service layer takes (amenities/repository.py `lock`) so
    -- concurrent inserts/updates for the same amenity serialize here too.
    SELECT COALESCE(s.capacity, a.capacity) INTO cap
    FROM amenities a
    LEFT JOIN amenity_slots s ON s.id = NEW.slot_id
    WHERE a.id = NEW.amenity_id
    FOR UPDATE OF a;

    IF cap IS NULL THEN
        RAISE EXCEPTION 'amenity % not found for booking capacity check', NEW.amenity_id
            USING ERRCODE = '23503';
    END IF;

    SELECT COALESCE(SUM(participant_count), 0) INTO used
    FROM amenity_bookings
    WHERE amenity_id = NEW.amenity_id
      AND status = 'confirmed'
      AND id <> NEW.id
      AND tstzrange(start_at, end_at) && tstzrange(NEW.start_at, NEW.end_at);

    IF used + NEW.participant_count > cap THEN
        RAISE EXCEPTION 'amenity_booking_capacity_exceeded'
            USING ERRCODE = '23514',
                  DETAIL = format('amenity %s: %s + %s > capacity %s',
                                   NEW.amenity_id, used, NEW.participant_count, cap);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_TRIGGER = """
CREATE TRIGGER gs_amenity_booking_capacity_guard
BEFORE INSERT OR UPDATE ON amenity_bookings
FOR EACH ROW EXECUTE FUNCTION gs_amenity_booking_capacity_guard();
"""


def upgrade() -> None:
    op.execute(_FUNCTION)
    op.execute(_TRIGGER)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS gs_amenity_booking_capacity_guard ON amenity_bookings;")
    op.execute("DROP FUNCTION IF EXISTS gs_amenity_booking_capacity_guard();")

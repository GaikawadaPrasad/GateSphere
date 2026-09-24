"""Backfill amenity slots: replace single wide 06:00-22:00 slot with 8×2-hour slots.

Revision ID: 0035_backfill_amenity_slots
Revises: 0034_sync_rbac_permissions
Create Date: 2026-09-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0035_backfill_amenity_slots"
down_revision = "0034_sync_rbac_permissions"
branch_labels = None
depends_on = None

_SLOT_TIMES = [
    ("06:00", "08:00"),
    ("08:00", "10:00"),
    ("10:00", "12:00"),
    ("12:00", "14:00"),
    ("14:00", "16:00"),
    ("16:00", "18:00"),
    ("18:00", "20:00"),
    ("20:00", "22:00"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # Find amenities whose only slot(s) span the full 06:00-22:00 window
    # (i.e. they have no proper 2-hour slots yet).
    bad_amenities = conn.execute(sa.text("""
            SELECT DISTINCT amenity_id
            FROM amenity_slots
            WHERE start_time = '06:00' AND end_time = '22:00'
              AND amenity_id NOT IN (
                  SELECT DISTINCT amenity_id
                  FROM amenity_slots
                  WHERE end_time - start_time = interval '2 hours'
              )
            """)).fetchall()

    if not bad_amenities:
        return

    amenity_ids = [str(row[0]) for row in bad_amenities]

    # Delete the bad wide slots
    conn.execute(
        sa.text(
            "DELETE FROM amenity_slots WHERE amenity_id = ANY(:ids) "
            "AND start_time = '06:00' AND end_time = '22:00'"
        ),
        {"ids": amenity_ids},
    )

    # Fetch amenity metadata needed to insert slots
    amenities = conn.execute(
        sa.text("SELECT id, community_id, capacity FROM amenities WHERE id = ANY(:ids)"),
        {"ids": amenity_ids},
    ).fetchall()

    rows = []
    for amenity_id, community_id, capacity in amenities:
        cap = capacity or 20
        for dow in range(7):
            for st, et in _SLOT_TIMES:
                rows.append(
                    {
                        "amenity_id": str(amenity_id),
                        "community_id": str(community_id),
                        "dow": dow,
                        "st": st,
                        "et": et,
                        "cap": cap,
                    }
                )

    conn.execute(
        sa.text("""
            INSERT INTO amenity_slots
                (id, community_id, amenity_id, day_of_week, start_time, end_time,
                 capacity, fee, is_active)
            VALUES
                (gen_random_uuid(), CAST(:community_id AS uuid), CAST(:amenity_id AS uuid),
                 :dow, CAST(:st AS time), CAST(:et AS time), :cap, 0, true)
            ON CONFLICT DO NOTHING
            """),
        rows,
    )


def downgrade() -> None:
    pass

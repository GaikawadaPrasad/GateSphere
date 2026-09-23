"""Add EXCLUDE constraint to amenity_bookings.

Revision ID: 0037_amenity_exclude_constraint
Revises: 0036_rbac_communities_view
Create Date: 2026-09-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0037_amenity_exclude_constraint"
down_revision = "0036_rbac_communities_view"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Pairwise EXCLUDE constraint rejected by CR-04 audit because amenities support
    # shared capacity > 1 (e.g. swimming pool, clubhouse). Overbooking is guarded
    # by the trigger gs_amenity_booking_capacity_guard in 0037_amenity_capacity_guard.py.
    # We drop the constraint if it was ever partially applied to prevent failures on overlapping data.
    op.execute("""
        ALTER TABLE amenity_bookings
        DROP CONSTRAINT IF EXISTS excl_amenity_booking_overlap;
    """)

def downgrade() -> None:
    op.execute("""
        ALTER TABLE amenity_bookings
        DROP CONSTRAINT IF EXISTS excl_amenity_booking_overlap;
    """)

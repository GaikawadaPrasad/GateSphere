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
    # We must ensure the btree_gist extension is available to use '=' with UUID in an EXCLUDE constraint
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist;')
    
    op.execute("""
        ALTER TABLE amenity_bookings
        ADD CONSTRAINT excl_amenity_booking_overlap
        EXCLUDE USING gist (
            amenity_id WITH =,
            tstzrange(start_at, end_at) WITH &&
        )
        WHERE (status = 'confirmed');
    """)

def downgrade() -> None:
    op.execute("""
        ALTER TABLE amenity_bookings
        DROP CONSTRAINT IF EXISTS excl_amenity_booking_overlap;
    """)

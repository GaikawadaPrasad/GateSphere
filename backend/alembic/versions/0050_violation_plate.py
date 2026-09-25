"""Add the observed plate to parking_violations (FR-08 unauthorized-parking reports).

An unauthorized vehicle is usually *unregistered*, so `vehicle_id` alone could not record
which car was reported. `registration_number` keeps the plate as observed; the service
auto-matches it to a registered vehicle when one exists. Existing rows are backfilled from
their linked vehicle.

Revision ID: 0050_violation_plate
Revises: 0049_invitation_email_sent_at
Create Date: 2026-09-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0050_violation_plate"
down_revision = "0049_invitation_email_sent_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "parking_violations",
        sa.Column("registration_number", sa.String(length=20), nullable=True),
    )
    op.create_index(
        "ix_parking_violations_registration_number",
        "parking_violations",
        ["registration_number"],
    )
    op.execute("""
        UPDATE parking_violations pv
           SET registration_number = v.registration_number
          FROM vehicles v
         WHERE v.id = pv.vehicle_id
           AND v.community_id = pv.community_id
           AND pv.registration_number IS NULL
        """)


def downgrade() -> None:
    op.drop_index("ix_parking_violations_registration_number", table_name="parking_violations")
    op.drop_column("parking_violations", "registration_number")

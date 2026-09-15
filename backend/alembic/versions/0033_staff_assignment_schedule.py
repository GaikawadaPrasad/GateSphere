"""FR-06: domestic staff unit assignment schedule days of week.

Revision ID: 0033_staff_assignment_schedule
Revises: 0032_delivery_protocol_scope
Create Date: 2026-09-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0033_staff_assignment_schedule"
down_revision = "0032_delivery_protocol_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "staff_unit_assignments",
        sa.Column(
            "days_of_week",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default=sa.text('\'["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]\'::jsonb'),
        ),
    )


def downgrade() -> None:
    op.drop_column("staff_unit_assignments", "days_of_week")

"""FR-07: delivery protocol unit scoping — allows resident unit overrides without overwriting community defaults.

Revision ID: 0032_delivery_protocol_unit_scope
Revises: 0031_survey_multi_question
Create Date: 2026-09-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0032_delivery_protocol_scope"
down_revision = "0031_survey_multi_question"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "delivery_protocols",
        sa.Column(
            "unit_id",
            sa.Uuid(),
            sa.ForeignKey("units.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    # Drop existing unique constraint on (community_id, delivery_type)
    op.execute(
        "ALTER TABLE delivery_protocols DROP CONSTRAINT IF EXISTS delivery_protocols_community_id_delivery_type_key"
    )
    # Create partial unique indexes for community default (unit_id IS NULL) and unit override (unit_id IS NOT NULL)
    op.create_index(
        "uq_delivery_protocols_community_default",
        "delivery_protocols",
        ["community_id", "delivery_type"],
        unique=True,
        postgresql_where=sa.text("unit_id IS NULL"),
    )
    op.create_index(
        "uq_delivery_protocols_unit_override",
        "delivery_protocols",
        ["community_id", "unit_id", "delivery_type"],
        unique=True,
        postgresql_where=sa.text("unit_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_delivery_protocols_unit_override", table_name="delivery_protocols")
    op.drop_index("uq_delivery_protocols_community_default", table_name="delivery_protocols")
    op.create_unique_constraint(
        "delivery_protocols_community_id_delivery_type_key",
        "delivery_protocols",
        ["community_id", "delivery_type"],
    )
    op.drop_column("delivery_protocols", "unit_id")

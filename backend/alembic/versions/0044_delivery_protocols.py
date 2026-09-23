"""FR-07: Delivery protocols update - support 4 canonical PRD protocols and lengthen protocol_type column.

Revision ID: 0044_delivery_protocols
Revises: 0043_ticket_closed_confirmed
Create Date: 2026-09-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0044_delivery_protocols"
down_revision = "0043_ticket_closed_confirmed"
branch_labels = None
depends_on = None

_ALLOWED_PROTOCOLS = (
    "'allow_at_gate', 'resident_approval_required', 'leave_at_gate_desk', 'direct_rejection', "
    "'leave_at_gate', 'collect_at_gate', 'direct_to_door', 'call_resident'"
)


def upgrade() -> None:
    op.alter_column(
        "delivery_protocols",
        "protocol_type",
        type_=sa.String(40),
        existing_type=sa.String(20),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "ck_delivery_protocol_type",
        "delivery_protocols",
        f"protocol_type IN ({_ALLOWED_PROTOCOLS})",
    )


def downgrade() -> None:
    op.drop_constraint("ck_delivery_protocol_type", "delivery_protocols", type_="check")
    op.execute(
        "UPDATE delivery_protocols SET protocol_type = 'collect_at_gate' WHERE protocol_type = 'resident_approval_required'"
    )
    op.execute(
        "UPDATE delivery_protocols SET protocol_type = 'leave_at_gate' WHERE protocol_type = 'leave_at_gate_desk'"
    )
    op.alter_column(
        "delivery_protocols",
        "protocol_type",
        type_=sa.String(20),
        existing_type=sa.String(40),
        existing_nullable=False,
    )

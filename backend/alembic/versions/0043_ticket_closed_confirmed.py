"""Enforce closed tickets must be resident confirmed.

Revision ID: 0043_ticket_closed_confirmed
Revises: 0042_resident_gate_view
Create Date: 2026-09-23
"""

from __future__ import annotations

from alembic import op

revision = "0043_ticket_closed_confirmed"
down_revision = "0042_resident_gate_view"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_service_tickets_closed_confirmed",
        "service_tickets",
        "status != 'closed' OR resident_confirmation_status = 'confirmed'",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_service_tickets_closed_confirmed",
        "service_tickets",
        type_="check",
    )

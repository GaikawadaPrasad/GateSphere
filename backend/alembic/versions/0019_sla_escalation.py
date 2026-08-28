"""FR-10 SLA escalation: escalation-path config on sla_policies + escalation
tracking columns on service_tickets.

Revision ID: 0019_sla_escalation
Revises: 0018_attachments_groups
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019_sla_escalation"
down_revision = "0018_attachments_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sla_policies",
        sa.Column(
            "at_risk_threshold_percent",
            sa.SmallInteger(),
            server_default="80",
            nullable=False,
        ),
    )
    op.add_column(
        "sla_policies",
        sa.Column(
            "escalation_notify_role",
            sa.String(length=40),
            server_default="facility_manager",
            nullable=False,
        ),
    )
    op.add_column(
        "service_tickets",
        sa.Column(
            "escalation_state",
            sa.String(length=12),
            server_default="on_track",
            nullable=False,
        ),
    )
    op.add_column(
        "service_tickets",
        sa.Column("escalation_level", sa.SmallInteger(), server_default="0", nullable=False),
    )
    op.add_column(
        "service_tickets",
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "service_tickets",
        sa.Column("sla_at_risk_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_service_tickets_escalation_state",
        "service_tickets",
        ["escalation_state"],
    )


def downgrade() -> None:
    op.drop_index("ix_service_tickets_escalation_state", table_name="service_tickets")
    op.drop_column("service_tickets", "sla_at_risk_at")
    op.drop_column("service_tickets", "escalated_at")
    op.drop_column("service_tickets", "escalation_level")
    op.drop_column("service_tickets", "escalation_state")
    op.drop_column("sla_policies", "escalation_notify_role")
    op.drop_column("sla_policies", "at_risk_threshold_percent")

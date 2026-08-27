"""delivery management (FR-07): delivery_protocols, deliveries, delivery_events.
Composite tenant-safe FKs to units + delivery_protocols. RLS on the two tenant tables.

Revision ID: 0010_deliveries
Revises: 0009_domestic_staff
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0010_deliveries"
down_revision = "0009_domestic_staff"
branch_labels = None
depends_on = None

_RLS = """
ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {t}
USING (
    coalesce(current_setting('app.community_ids', true), '') = ''
    OR community_id IS NULL
    OR community_id::text = ANY (string_to_array(current_setting('app.community_ids', true), ','))
);
"""
_TENANT = ["delivery_protocols", "deliveries"]


def _ts():
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def upgrade() -> None:
    op.create_table(
        "delivery_protocols",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("delivery_type", sa.String(20), nullable=False),
        sa.Column("protocol_type", sa.String(20), nullable=False, server_default="collect_at_gate"),
        sa.Column("requires_otp", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("allow_direct_entry", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("leave_at_gate", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("allowed_start_time", sa.Time()),
        sa.Column("allowed_end_time", sa.Time()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "delivery_type"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("resident_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("protocol_id", sa.Uuid()),
        sa.Column("delivery_type", sa.String(20), nullable=False),
        sa.Column("provider_name", sa.String(120)),
        sa.Column("executive_name", sa.String(120)),
        sa.Column("executive_phone", sa.String(20)),
        sa.Column("tracking_reference", sa.String(120)),
        sa.Column("approval_status", sa.String(15), nullable=False, server_default="pending"),
        sa.Column("approved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("expected_at", sa.DateTime(timezone=True)),
        sa.Column("arrived_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(15), nullable=False, server_default="expected"),
        sa.Column("parcel_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text()),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"],
            ["units.id", "units.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["protocol_id", "community_id"],
            ["delivery_protocols.id", "delivery_protocols.community_id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )
    op.create_index("ix_deliveries_approval_status", "deliveries", ["approval_status"])
    op.create_index("ix_deliveries_status", "deliveries", ["status"])

    op.create_table(
        "delivery_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "delivery_id",
            sa.Uuid(),
            sa.ForeignKey("deliveries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("event_type", sa.String(15), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("remarks", sa.Text()),
        sa.Column("metadata", JSONB()),
        *_ts(),
    )
    op.create_index("ix_delivery_events_occurred_at", "delivery_events", ["occurred_at"])

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in ("delivery_events", "deliveries", "delivery_protocols"):
        op.drop_table(t)

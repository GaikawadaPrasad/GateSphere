"""vehicle & parking (FR-08): vehicles, parking_rules, parking_slots,
parking_allocations, vehicle_entries, parking_violations. RLS on all six.

Revision ID: 0011_vehicles
Revises: 0010_deliveries
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_vehicles"
down_revision = "0010_deliveries"
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
_TENANT = [
    "vehicles",
    "parking_rules",
    "parking_slots",
    "parking_allocations",
    "vehicle_entries",
    "parking_violations",
]


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


def _community_col():
    return sa.Column(
        "community_id",
        sa.Uuid(),
        sa.ForeignKey("communities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


def upgrade() -> None:
    op.create_table(
        "vehicles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("resident_profile_id", sa.Uuid()),
        sa.Column("visitor_id", sa.Uuid()),
        sa.Column("unit_id", sa.Uuid()),
        sa.Column("vehicle_type", sa.String(15), nullable=False),
        sa.Column("registration_number", sa.String(20), nullable=False),
        sa.Column("make", sa.String(60)),
        sa.Column("model", sa.String(60)),
        sa.Column("color", sa.String(30)),
        sa.Column("sticker_number", sa.String(40)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "registration_number"),
        sa.UniqueConstraint("id", "community_id"),
        sa.CheckConstraint(
            "(resident_profile_id IS NOT NULL) <> (visitor_id IS NOT NULL)",
            name="ck_vehicle_owner_xor",
        ),
        *_ts(),
    )

    op.create_table(
        "parking_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column(
            "allow_multi_slot_vehicle", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("allow_guest_parking", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("max_active_slots_per_unit", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("violation_grace_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.UniqueConstraint("community_id"),
        *_ts(),
    )

    op.create_table(
        "parking_slots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("tower_id", sa.Uuid(), sa.ForeignKey("towers.id", ondelete="SET NULL")),
        sa.Column("slot_code", sa.String(20), nullable=False),
        sa.Column("slot_type", sa.String(15), nullable=False, server_default="car"),
        sa.Column("level", sa.String(20)),
        sa.Column("status", sa.String(12), nullable=False, server_default="available"),
        sa.Column("is_guest_slot", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reserved_for_unit_id", sa.Uuid()),
        sa.UniqueConstraint("community_id", "slot_code"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )
    op.create_index("ix_parking_slots_status", "parking_slots", ["status"])

    op.create_table(
        "parking_allocations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("slot_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("vehicle_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("unit_id", sa.Uuid()),
        sa.Column(
            "allocated_from",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("allocated_to", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        sa.Column(
            "allocated_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.ForeignKeyConstraint(
            ["slot_id", "community_id"],
            ["parking_slots.id", "parking_slots.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["vehicle_id", "community_id"],
            ["vehicles.id", "vehicles.community_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "allocated_to IS NULL OR allocated_to > allocated_from",
            name="ck_parking_allocation_window",
        ),
        *_ts(),
    )
    op.create_index("ix_parking_allocations_status", "parking_allocations", ["status"])
    op.create_index(
        "uq_parking_slot_active",
        "parking_allocations",
        ["slot_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "uq_parking_vehicle_active",
        "parking_allocations",
        ["vehicle_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "vehicle_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("vehicle_id", sa.Uuid()),
        sa.Column("registration_number", sa.String(20), nullable=False, index=True),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column(
            "entry_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("exit_at", sa.DateTime(timezone=True)),
        sa.Column("entry_guard_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("exit_guard_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("source_type", sa.String(10), nullable=False, server_default="unknown"),
        sa.Column("reference_id", sa.Uuid()),
        sa.Column("status", sa.String(10), nullable=False, server_default="inside"),
        sa.Column("is_flagged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(
            "exit_at IS NULL OR exit_at >= entry_at", name="ck_vehicle_entry_window"
        ),
        *_ts(),
    )
    op.create_index("ix_vehicle_entries_entry_at", "vehicle_entries", ["entry_at"])
    op.create_index("ix_vehicle_entries_status", "vehicle_entries", ["status"])

    op.create_table(
        "parking_violations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("vehicle_id", sa.Uuid()),
        sa.Column("parking_slot_id", sa.Uuid()),
        sa.Column("reported_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("violation_type", sa.String(15), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("evidence_url", sa.Text()),
        sa.Column("fine_amount", sa.Numeric(10, 2)),
        sa.Column("status", sa.String(12), nullable=False, server_default="open"),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        *_ts(),
    )
    op.create_index("ix_parking_violations_status", "parking_violations", ["status"])

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in (
        "parking_violations",
        "vehicle_entries",
        "parking_allocations",
        "parking_slots",
        "parking_rules",
        "vehicles",
    ):
        op.drop_table(t)

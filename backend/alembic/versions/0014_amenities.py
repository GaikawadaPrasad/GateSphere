"""amenity booking (FR-11): amenities, amenity_slots, amenity_rules, amenity_blocks,
amenity_bookings. Composite tenant-safe FKs. RLS on all five.

Revision ID: 0014_amenities
Revises: 0013_complaints
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0014_amenities"
down_revision = "0013_complaints"
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
    "amenities",
    "amenity_slots",
    "amenity_rules",
    "amenity_blocks",
    "amenity_bookings",
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
        "amenities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("amenity_type", sa.String(20), nullable=False, server_default="other"),
        sa.Column("location_text", sa.String(255)),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("booking_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "code"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "amenity_slots",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("amenity_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("capacity", sa.Integer()),
        sa.Column("fee", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("id", "community_id"),
        sa.CheckConstraint("end_time > start_time", name="ck_amenity_slot_window"),
        *_ts(),
    )

    op.create_table(
        "amenity_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("amenity_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("rule_type", sa.String(30), nullable=False),
        sa.Column("rule_value", JSONB(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("community_id", "amenity_id", "rule_type"),
        *_ts(),
    )

    op.create_table(
        "amenity_blocks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("amenity_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("blocked_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("blocked_to", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("blocked_to > blocked_from", name="ck_amenity_block_window"),
        *_ts(),
    )

    op.create_table(
        "amenity_bookings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("amenity_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("slot_id", sa.Uuid()),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("resident_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("booking_date", sa.Date(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("participant_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(12), nullable=False, server_default="confirmed"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("cancellation_reason", sa.Text()),
        sa.ForeignKeyConstraint(
            ["amenity_id", "community_id"],
            ["amenities.id", "amenities.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"],
            ["units.id", "units.community_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("end_at > start_at", name="ck_amenity_booking_window"),
        *_ts(),
    )
    op.create_index("ix_amenity_bookings_booking_date", "amenity_bookings", ["booking_date"])
    op.create_index("ix_amenity_bookings_status", "amenity_bookings", ["status"])

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in (
        "amenity_bookings",
        "amenity_blocks",
        "amenity_rules",
        "amenity_slots",
        "amenities",
    ):
        op.drop_table(t)

"""residents (FR-03): resident_profiles, unit_occupancies, family_members,
emergency_contacts, move_records

Adds UQ(id, community_id) to units so the child tables can use composite tenant-safe FKs.
RLS enabled on all five new tables.

Revision ID: 0006_residents
Revises: 0005_audit_log_erd_shape
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_residents"
down_revision = "0005_audit_log_erd_shape"
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

_NEW_TABLES = [
    "resident_profiles",
    "unit_occupancies",
    "family_members",
    "emergency_contacts",
    "move_records",
]


def _ts() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def upgrade() -> None:
    op.create_unique_constraint("uq_units_id_community", "units", ["id", "community_id"])

    op.create_table(
        "resident_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("profile_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("kyc_status", sa.String(20), nullable=False, server_default="not_started"),
        sa.Column("move_in_date", sa.Date()),
        sa.Column("move_out_date", sa.Date()),
        sa.Column("emergency_notes", sa.Text()),
        sa.UniqueConstraint("community_id", "user_id"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "unit_occupancies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("resident_profile_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("occupancy_role", sa.String(20), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("start_date", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("end_date", sa.Date()),
        sa.Column("agreement_reference", sa.String(120)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
        *_ts(),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_unit_primary_active ON unit_occupancies (unit_id) "
        "WHERE is_primary AND is_active"
    )

    op.create_table(
        "family_members",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("primary_resident_profile_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("full_name", sa.String(180), nullable=False),
        sa.Column("relationship", sa.String(20), nullable=False),
        sa.Column("date_of_birth", sa.Date()),
        sa.Column("phone", sa.String(20)),
        sa.Column("access_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["primary_resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
        *_ts(),
    )

    op.create_table(
        "emergency_contacts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("resident_profile_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("relationship", sa.String(40), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("alternate_phone", sa.String(20)),
        sa.Column("priority", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
        *_ts(),
    )

    op.create_table(
        "move_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("resident_profile_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("move_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="requested", index=True),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("clearance_notes", sa.Text()),
        sa.Column("approved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["resident_profile_id", "community_id"],
            ["resident_profiles.id", "resident_profiles.community_id"],
            ondelete="CASCADE",
        ),
        *_ts(),
    )

    for t in _NEW_TABLES:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in reversed(_NEW_TABLES):
        op.drop_table(t)
    op.drop_constraint("uq_units_id_community", "units", type_="unique")

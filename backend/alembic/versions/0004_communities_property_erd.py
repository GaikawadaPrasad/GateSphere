"""align community/property schema to ERD v1.2 + add gates (FR-03)

Reshapes towers/floors/units to the approved ERD columns, adds composite tenant-safe FKs
(tower -> floor -> unit), adds the `gates` table, and re-establishes RLS on all four.

Pre-release: this drops and recreates towers/floors/units (their data is re-seeded).

Revision ID: 0004_communities_property_erd
Revises: 0003_rls_tenant_isolation
Create Date: 2026-08-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_communities_property_erd"
down_revision = "0003_rls_tenant_isolation"
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
    op.drop_table("units")
    op.drop_table("floors")
    op.drop_table("towers")

    # --- communities: add ERD columns ---
    with op.batch_alter_table("communities") as b:
        b.add_column(sa.Column("address_line1", sa.String(255)))
        b.add_column(sa.Column("address_line2", sa.String(255)))
        b.add_column(sa.Column("city", sa.String(120)))
        b.add_column(sa.Column("state", sa.String(120)))
        b.add_column(sa.Column("postal_code", sa.String(20)))
        b.add_column(sa.Column("country", sa.String(80), nullable=False, server_default="India"))
        b.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
        b.drop_column("address")

    # --- gates ---
    op.create_table(
        "gates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("gate_type", sa.String(20), nullable=False, server_default="main"),
        sa.Column("latitude", sa.Numeric(9, 6)),
        sa.Column("longitude", sa.Numeric(9, 6)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "code"),
        *_ts(),
    )

    # --- towers ---
    op.create_table(
        "towers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("structure_type", sa.String(20), nullable=False, server_default="tower"),
        sa.Column("total_floors", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "name"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    # --- floors (composite FK to towers) ---
    op.create_table(
        "floors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tower_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("floor_number", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(40)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["tower_id", "community_id"], ["towers.id", "towers.community_id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("community_id", "tower_id", "floor_number"),
        sa.UniqueConstraint("id", "community_id", "tower_id"),
        *_ts(),
    )

    # --- units (composite FK to floors) ---
    op.create_table(
        "units",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tower_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("floor_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("unit_number", sa.String(32), nullable=False),
        sa.Column("unit_type", sa.String(20), nullable=False, server_default="apartment"),
        sa.Column("bedrooms", sa.SmallInteger()),
        sa.Column("area_sqft", sa.Numeric(10, 2)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["floor_id", "community_id", "tower_id"],
            ["floors.id", "floors.community_id", "floors.tower_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("community_id", "tower_id", "floor_id", "unit_number"),
        *_ts(),
    )

    for t in ("gates", "towers", "floors", "units"):
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    op.drop_table("units")
    op.drop_table("floors")
    op.drop_table("towers")
    op.drop_table("gates")

    with op.batch_alter_table("communities") as b:
        b.add_column(sa.Column("address", sa.String(1024)))
        b.drop_column("is_active")
        b.drop_column("country")
        b.drop_column("postal_code")
        b.drop_column("state")
        b.drop_column("city")
        b.drop_column("address_line2")
        b.drop_column("address_line1")

    # recreate the 0001-shaped tables so the chain stays reversible
    op.create_table(
        "towers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("floors_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("community_id", "name"),
        *_ts(),
    )
    op.create_table(
        "floors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tower_id",
            sa.Uuid(),
            sa.ForeignKey("towers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.UniqueConstraint("tower_id", "number"),
        *_ts(),
    )
    op.create_table(
        "units",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tower_id",
            sa.Uuid(),
            sa.ForeignKey("towers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "floor_id",
            sa.Uuid(),
            sa.ForeignKey("floors.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String(32), nullable=False),
        sa.Column("unit_type", sa.String(32), nullable=False, server_default="apartment"),
        sa.Column("bedrooms", sa.Integer()),
        sa.UniqueConstraint("community_id", "label"),
        *_ts(),
    )
    for t in ("towers", "floors", "units"):
        op.execute(_RLS.format(t=t))

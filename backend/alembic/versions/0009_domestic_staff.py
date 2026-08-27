"""domestic staff (FR-06): domestic_staff, staff_unit_assignments, staff_attendance,
staff_ratings. Composite tenant-safe FKs to units + domestic_staff. RLS on all four.

Revision ID: 0009_domestic_staff
Revises: 0008_gate
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_domestic_staff"
down_revision = "0008_gate"
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
_TENANT = ["domestic_staff", "staff_unit_assignments", "staff_attendance", "staff_ratings"]


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
        "domestic_staff",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("full_name", sa.String(180), nullable=False),
        sa.Column("staff_type", sa.String(20), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("photo_url", sa.Text()),
        sa.Column("id_type", sa.String(30)),
        sa.Column("id_number_hash", sa.String(128)),
        sa.Column(
            "police_verification_status",
            sa.String(15),
            nullable=False,
            server_default="not_started",
        ),
        sa.Column("verification_expiry", sa.Date()),
        sa.Column("emergency_address", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "phone"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "staff_unit_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("staff_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("approved_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("work_type", sa.String(15), nullable=False, server_default="part_time"),
        sa.Column("start_date", sa.Date()),
        sa.Column("end_date", sa.Date()),
        sa.Column("time_from", sa.Time()),
        sa.Column("time_to", sa.Time()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["staff_id", "community_id"],
            ["domestic_staff.id", "domestic_staff.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"],
            ["units.id", "units.community_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR start_date <= end_date",
            name="ck_staff_assignment_dates",
        ),
        *_ts(),
    )
    op.create_index(
        "uq_staff_unit_active",
        "staff_unit_assignments",
        ["staff_id", "unit_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "staff_attendance",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("staff_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column(
            "check_in_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("check_out_at", sa.DateTime(timezone=True)),
        sa.Column("check_in_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "check_out_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("attendance_status", sa.String(10), nullable=False, server_default="inside"),
        sa.ForeignKeyConstraint(
            ["staff_id", "community_id"],
            ["domestic_staff.id", "domestic_staff.community_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "check_out_at IS NULL OR check_out_at >= check_in_at",
            name="ck_staff_attendance_window",
        ),
        *_ts(),
    )
    op.create_index("ix_staff_attendance_check_in_at", "staff_attendance", ["check_in_at"])
    op.create_index("ix_staff_attendance_status", "staff_attendance", ["attendance_status"])
    op.create_index(
        "uq_staff_attendance_open",
        "staff_attendance",
        ["staff_id"],
        unique=True,
        postgresql_where=sa.text("check_out_at IS NULL"),
    )

    op.create_table(
        "staff_ratings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("staff_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("unit_id", sa.Uuid()),
        sa.Column("resident_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("feedback", sa.Text()),
        sa.ForeignKeyConstraint(
            ["staff_id", "community_id"],
            ["domestic_staff.id", "domestic_staff.community_id"],
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_staff_rating_range"),
        sa.UniqueConstraint("staff_id", "unit_id", "resident_user_id"),
        *_ts(),
    )

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in ("staff_ratings", "staff_attendance", "staff_unit_assignments", "domestic_staff"):
        op.drop_table(t)

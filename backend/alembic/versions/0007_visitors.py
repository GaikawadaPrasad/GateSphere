"""visitors (FR-04): visitors, visitor_blacklist, visitor_requests, visitor_approvals,
visitor_passes, visitor_entries, visitor_policies

Also renames the audit_logs indexes orphaned by migration 0005's column rename.
RLS on the tenant tables.

Revision ID: 0007_visitors
Revises: 0006_residents
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_visitors"
down_revision = "0006_residents"
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
    "visitors",
    "visitor_blacklist",
    "visitor_requests",
    "visitor_entries",
    "visitor_policies",
]
_ALL_DROP = [
    "visitor_passes",
    "visitor_entries",
    "visitor_approvals",
    "visitor_requests",
    "visitors",
    "visitor_policies",
    "visitor_blacklist",
]

FK_C = ("communities.id",)


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
        "visitors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("full_name", sa.String(180), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("photo_url", sa.Text()),
        sa.Column("id_type", sa.String(30)),
        sa.Column("id_number_hash", sa.String(128)),
        sa.Column("vehicle_number", sa.String(20)),
        sa.Column("frequent_visitor_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("visit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_visit_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("community_id", "phone"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "visitor_blacklist",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("visitor_id", sa.Uuid(), index=True),
        sa.Column("phone_hash", sa.String(128), nullable=False, index=True),
        sa.Column("id_number_hash", sa.String(128), index=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("risk_level", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("active_from", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("active_until", sa.Date()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        *_ts(),
    )

    op.create_table(
        "visitor_policies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("approval_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("photo_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("otp_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pass_ttl_minutes", sa.Integer(), nullable=False, server_default="240"),
        sa.Column("blacklist_mode", sa.String(20), nullable=False, server_default="block"),
        sa.UniqueConstraint("community_id"),
        *_ts(),
    )

    op.create_table(
        "visitor_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("visitor_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("host_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("visitor_type", sa.String(20), nullable=False),
        sa.Column("purpose", sa.String(255)),
        sa.Column("expected_at", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(15), nullable=False, server_default="pending", index=True),
        sa.Column("approval_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("vehicle_number", sa.String(20)),
        sa.Column("group_label", sa.String(120)),
        sa.Column("party_size", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["visitor_id", "community_id"],
            ["visitors.id", "visitors.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "visitor_approvals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Uuid(),
            sa.ForeignKey("visitor_requests.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("approver_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("decision", sa.String(10), nullable=False),
        sa.Column("remarks", sa.Text()),
        sa.Column(
            "decided_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("request_id", "approver_user_id"),
        *_ts(),
    )

    op.create_table(
        "visitor_passes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "request_id",
            sa.Uuid(),
            sa.ForeignKey("visitor_requests.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("pass_type", sa.String(10), nullable=False, server_default="qr"),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True, index=True),
        sa.Column("pin_hash", sa.String(128)),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_entries", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("entry_count", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        *_ts(),
    )

    op.create_table(
        "visitor_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "request_id",
            sa.Uuid(),
            sa.ForeignKey("visitor_requests.id", ondelete="SET NULL"),
            index=True,
        ),
        sa.Column("visitor_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column("entry_guard_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("exit_guard_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("entry_at", sa.DateTime(timezone=True), index=True),
        sa.Column("exit_at", sa.DateTime(timezone=True)),
        sa.Column("entry_photo_url", sa.Text()),
        sa.Column("vehicle_number", sa.String(20)),
        sa.Column("status", sa.String(10), nullable=False, server_default="inside", index=True),
        sa.Column("denial_reason", sa.Text()),
        sa.ForeignKeyConstraint(
            ["visitor_id", "community_id"],
            ["visitors.id", "visitors.community_id"],
            ondelete="CASCADE",
        ),
        *_ts(),
    )

    op.execute("ALTER INDEX IF EXISTS ix_audit_logs_at RENAME TO ix_audit_logs_created_at")
    op.execute("ALTER INDEX IF EXISTS ix_audit_logs_actor_user_id RENAME TO ix_audit_logs_user_id")

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    op.execute("ALTER INDEX IF EXISTS ix_audit_logs_created_at RENAME TO ix_audit_logs_at")
    op.execute("ALTER INDEX IF EXISTS ix_audit_logs_user_id RENAME TO ix_audit_logs_actor_user_id")
    for t in _ALL_DROP:
        op.drop_table(t)

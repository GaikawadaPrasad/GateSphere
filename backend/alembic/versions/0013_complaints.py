"""complaint & service desk (FR-10): service_categories, sla_policies, service_tickets,
ticket_status_history, ticket_assignments, ticket_messages, ticket_feedback.
Composite tenant-safe FKs to units + service_categories. RLS on the tenant tables.

Revision ID: 0013_complaints
Revises: 0012_billing
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013_complaints"
down_revision = "0012_billing"
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
_TENANT = ["service_categories", "sla_policies", "service_tickets"]


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
        "service_categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("default_priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "code"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "sla_policies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("category_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("response_minutes", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("resolution_minutes", sa.Integer(), nullable=False, server_default="1440"),
        sa.Column("escalation_minutes", sa.Integer(), nullable=False, server_default="2880"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(
            ["category_id", "community_id"],
            ["service_categories.id", "service_categories.community_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("community_id", "category_id", "priority"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "service_tickets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("ticket_number", sa.String(40), nullable=False),
        sa.Column("raised_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("category_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("sla_policy_id", sa.Uuid()),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(24), nullable=False, server_default="created"),
        sa.Column(
            "resident_confirmation_status",
            sa.String(12),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("first_response_due_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_due_at", sa.DateTime(timezone=True)),
        sa.Column("escalation_due_at", sa.DateTime(timezone=True)),
        sa.Column("first_responded_at", sa.DateTime(timezone=True)),
        sa.Column("sla_breached_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"],
            ["units.id", "units.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["category_id", "community_id"],
            ["service_categories.id", "service_categories.community_id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("community_id", "ticket_number"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )
    op.create_index("ix_service_tickets_status", "service_tickets", ["status"])

    op.create_table(
        "ticket_status_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "ticket_id",
            sa.Uuid(),
            sa.ForeignKey("service_tickets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("from_status", sa.String(24)),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("changed_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("remarks", sa.Text()),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        *_ts(),
    )

    op.create_table(
        "ticket_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "ticket_id",
            sa.Uuid(),
            sa.ForeignKey("service_tickets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("assigned_to_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("vendor_name", sa.String(160)),
        sa.Column("assigned_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("unassigned_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "(assigned_to_user_id IS NOT NULL) <> (vendor_name IS NOT NULL)",
            name="ck_ticket_assignment_executor_xor",
        ),
        *_ts(),
    )

    op.create_table(
        "ticket_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "ticket_id",
            sa.Uuid(),
            sa.ForeignKey("service_tickets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("sender_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default=sa.false()),
        *_ts(),
    )

    op.create_table(
        "ticket_feedback",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "ticket_id",
            sa.Uuid(),
            sa.ForeignKey("service_tickets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("resident_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rating", sa.SmallInteger(), nullable=False),
        sa.Column("comments", sa.Text()),
        sa.UniqueConstraint("ticket_id"),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_ticket_feedback_rating"),
        *_ts(),
    )

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in (
        "ticket_feedback",
        "ticket_messages",
        "ticket_assignments",
        "ticket_status_history",
        "service_tickets",
        "sla_policies",
        "service_categories",
    ):
        op.drop_table(t)

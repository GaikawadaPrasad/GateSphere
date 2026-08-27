"""maintenance & billing (FR-09): charge_heads, billing_rules, maintenance_invoices,
invoice_items, payments, payment_allocations, ledger_entries. RLS on the tenant tables.

Revision ID: 0012_billing
Revises: 0011_vehicles
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0012_billing"
down_revision = "0011_vehicles"
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
    "charge_heads",
    "billing_rules",
    "maintenance_invoices",
    "payments",
    "ledger_entries",
]
_M = sa.Numeric(12, 2)


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
        "charge_heads",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("calculation_type", sa.String(15), nullable=False, server_default="flat"),
        sa.Column("default_amount", _M, nullable=False, server_default="0"),
        sa.Column("taxable", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "code"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "billing_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("due_day", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("grace_days", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("late_fee_mode", sa.String(12), nullable=False, server_default="flat"),
        sa.Column("late_fee_value", _M, nullable=False, server_default="0"),
        sa.Column("tax_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("allow_advance_payment", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id"),
        *_ts(),
    )

    op.create_table(
        "maintenance_invoices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("unit_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("billed_to_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("invoice_number", sa.String(40), nullable=False),
        sa.Column("billing_period_start", sa.Date()),
        sa.Column("billing_period_end", sa.Date()),
        sa.Column("issue_date", sa.Date()),
        sa.Column("due_date", sa.Date()),
        sa.Column("subtotal", _M, nullable=False, server_default="0"),
        sa.Column("discount", _M, nullable=False, server_default="0"),
        sa.Column("late_fee", _M, nullable=False, server_default="0"),
        sa.Column("tax", _M, nullable=False, server_default="0"),
        sa.Column("total_amount", _M, nullable=False, server_default="0"),
        sa.Column("amount_paid", _M, nullable=False, server_default="0"),
        sa.Column("balance_due", _M, nullable=False, server_default="0"),
        sa.Column("status", sa.String(15), nullable=False, server_default="draft"),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"],
            ["units.id", "units.community_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("community_id", "invoice_number"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )
    op.create_index("ix_maintenance_invoices_status", "maintenance_invoices", ["status"])

    op.create_table(
        "invoice_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.Uuid(),
            sa.ForeignKey("maintenance_invoices.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("charge_head_id", sa.Uuid()),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit_rate", _M, nullable=False, server_default="0"),
        sa.Column("amount", _M, nullable=False, server_default="0"),
        sa.Column("taxable", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("metadata", JSONB()),
        *_ts(),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("payer_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("payment_reference", sa.String(60), nullable=False),
        sa.Column("amount", _M, nullable=False),
        sa.Column("payment_method", sa.String(15), nullable=False, server_default="upi"),
        sa.Column("payment_status", sa.String(12), nullable=False, server_default="success"),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("gateway_name", sa.String(40)),
        sa.Column("gateway_transaction_id", sa.String(80)),
        sa.Column("remarks", sa.Text()),
        sa.UniqueConstraint("payment_reference"),
        sa.CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        *_ts(),
    )
    op.create_index("ix_payments_status", "payments", ["payment_status"])

    op.create_table(
        "payment_allocations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "payment_id",
            sa.Uuid(),
            sa.ForeignKey("payments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "invoice_id",
            sa.Uuid(),
            sa.ForeignKey("maintenance_invoices.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("allocated_amount", _M, nullable=False),
        sa.CheckConstraint("allocated_amount > 0", name="ck_allocation_amount_positive"),
        sa.UniqueConstraint("payment_id", "invoice_id"),
        *_ts(),
    )

    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entry_seq", sa.BigInteger(), sa.Identity(), nullable=False),
        _community_col(),
        sa.Column("unit_id", sa.Uuid(), index=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("entry_type", sa.String(10), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_id", sa.Uuid()),
        sa.Column("amount", _M, nullable=False),
        sa.Column("balance_after", _M, nullable=False),
        sa.Column(
            "entry_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("narration", sa.Text()),
        *_ts(),
    )
    op.create_index("ix_ledger_entries_entry_date", "ledger_entries", ["entry_date"])
    op.create_index("ix_ledger_entries_entry_seq", "ledger_entries", ["entry_seq"])

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in (
        "ledger_entries",
        "payment_allocations",
        "payments",
        "invoice_items",
        "maintenance_invoices",
        "billing_rules",
        "charge_heads",
    ):
        op.drop_table(t)

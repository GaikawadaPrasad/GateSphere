"""FR-09 SM-3: payment refund state (success -> refunded).

`payment_status` already CHECK-allows `refunded` (migration 0025); this adds the
`refunded_at` timestamp column. Payments remain SIMULATED — a refund reverses the ledger
and invoice balances in one transaction, no external gateway.

Revision ID: 0029_payment_refund
Revises: 0028_audit_immutable_role
Create Date: 2026-08-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0029_payment_refund"
down_revision = "0028_audit_immutable_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "refunded_at")

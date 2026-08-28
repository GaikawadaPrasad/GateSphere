"""FR-09 payment receipts: every payment gets a stable per-community receipt number.

Revision ID: 0021_payment_receipts
Revises: 0020_visitor_groups
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_payment_receipts"
down_revision = "0020_visitor_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("receipt_number", sa.String(length=40), nullable=True))
    op.add_column(
        "payments", sa.Column("receipt_issued_at", sa.DateTime(timezone=True), nullable=True)
    )
    # backfill existing rows: RCP-<YYYY>-<nnnnnn> numbered per community by paid_at
    op.execute(
        """
        WITH numbered AS (
            SELECT id,
                   'RCP-' || to_char(coalesce(paid_at, created_at), 'YYYY') || '-' ||
                   lpad(row_number() OVER (
                       PARTITION BY community_id
                       ORDER BY coalesce(paid_at, created_at), id
                   )::text, 6, '0') AS rcpt,
                   coalesce(paid_at, created_at) AS issued
            FROM payments
        )
        UPDATE payments p
        SET receipt_number = n.rcpt, receipt_issued_at = n.issued
        FROM numbered n
        WHERE p.id = n.id
        """
    )
    op.create_unique_constraint(
        "uq_payment_receipt_number",
        "payments",
        ["community_id", "receipt_number"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_payment_receipt_number", "payments", type_="unique")
    op.drop_column("payments", "receipt_issued_at")
    op.drop_column("payments", "receipt_number")

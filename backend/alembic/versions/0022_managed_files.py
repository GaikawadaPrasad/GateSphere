"""NFR-SEC-07: managed_files tracks every presigned upload and its post-upload
confirmation (actual size + magic-number check) before a domain record may reference it.

Revision ID: 0022_managed_files
Revises: 0021_payment_receipts
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_managed_files"
down_revision = "0021_payment_receipts"
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


def upgrade() -> None:
    op.create_table(
        "managed_files",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("community_id", sa.Uuid(), sa.ForeignKey("communities.id", ondelete="CASCADE")),
        sa.Column("object_key", sa.String(400), nullable=False, unique=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("declared_content_type", sa.String(120), nullable=False),
        sa.Column("declared_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="pending"),
        sa.Column("detected_content_type", sa.String(120)),
        sa.Column("size_bytes", sa.BigInteger()),
        sa.Column("reject_reason", sa.String(200)),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
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
        sa.Index("ix_managed_files_status", "status"),
    )
    op.execute(_RLS.format(t="managed_files"))


def downgrade() -> None:
    op.drop_table("managed_files")

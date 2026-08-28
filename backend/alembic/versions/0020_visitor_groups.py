"""FR-04 multi-visitor grouping: visitor_request_members links several distinct
visitor records to one approved request.

Revision ID: 0020_visitor_groups
Revises: 0019_sla_escalation
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020_visitor_groups"
down_revision = "0019_sla_escalation"
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
        "visitor_request_members",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("request_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("visitor_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["request_id", "community_id"],
            ["visitor_requests.id", "visitor_requests.community_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["visitor_id", "community_id"],
            ["visitors.id", "visitors.community_id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("request_id", "visitor_id"),
    )
    op.execute(_RLS.format(t="visitor_request_members"))


def downgrade() -> None:
    op.drop_table("visitor_request_members")

"""communication & broadcasts (FR-12): announcements, announcement_targets, polls,
poll_options, poll_responses, poll_response_options. RLS on the tenant tables.

Revision ID: 0015_communication
Revises: 0014_amenities
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0015_communication"
down_revision = "0014_amenities"
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
_TENANT = ["announcements", "polls"]


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
        "announcements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("announcement_type", sa.String(15), nullable=False, server_default="notice"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False, server_default="normal"),
        sa.Column("publish_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("event_start_at", sa.DateTime(timezone=True)),
        sa.Column("event_end_at", sa.DateTime(timezone=True)),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )
    op.create_index("ix_announcements_is_published", "announcements", ["is_published"])

    op.create_table(
        "announcement_targets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "announcement_id",
            sa.Uuid(),
            sa.ForeignKey("announcements.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tower_id", sa.Uuid(), sa.ForeignKey("towers.id", ondelete="CASCADE")),
        sa.Column("unit_id", sa.Uuid(), sa.ForeignKey("units.id", ondelete="CASCADE")),
        sa.Column("role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE")),
        sa.Column("target_all_community", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(
            "target_all_community "
            "OR tower_id IS NOT NULL OR unit_id IS NOT NULL OR role_id IS NOT NULL",
            name="ck_announcement_target_valid",
        ),
        *_ts(),
    )

    op.create_table(
        "polls",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "announcement_id",
            sa.Uuid(),
            sa.ForeignKey("announcements.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("question", sa.String(400), nullable=False),
        sa.Column("allow_multiple", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("opens_at", sa.DateTime(timezone=True)),
        sa.Column("closes_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
        sa.UniqueConstraint("announcement_id"),
        *_ts(),
    )
    op.create_index("ix_polls_status", "polls", ["status"])

    op.create_table(
        "poll_options",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "poll_id",
            sa.Uuid(),
            sa.ForeignKey("polls.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("option_text", sa.String(200), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        *_ts(),
    )

    op.create_table(
        "poll_responses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "poll_id",
            sa.Uuid(),
            sa.ForeignKey("polls.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "responded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("poll_id", "user_id"),
        *_ts(),
    )

    op.create_table(
        "poll_response_options",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "response_id",
            sa.Uuid(),
            sa.ForeignKey("poll_responses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "option_id",
            sa.Uuid(),
            sa.ForeignKey("poll_options.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.UniqueConstraint("response_id", "option_id"),
        *_ts(),
    )

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in (
        "poll_response_options",
        "poll_responses",
        "poll_options",
        "polls",
        "announcement_targets",
        "announcements",
    ):
        op.drop_table(t)

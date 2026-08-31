"""FR-12 GAP-2: event RSVPs — a resident responds to an `event` announcement.

Revision ID: 0030_event_rsvp
Revises: 0029_payment_refund
Create Date: 2026-08-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0030_event_rsvp"
down_revision = "0029_payment_refund"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_rsvps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "community_id",
            UUID(as_uuid=True),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "announcement_id",
            UUID(as_uuid=True),
            sa.ForeignKey("announcements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("response", sa.String(length=10), nullable=False),
        sa.Column("guests", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("note", sa.String(length=500), nullable=True),
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
        sa.UniqueConstraint("announcement_id", "user_id", name="uq_event_rsvp_user"),
        sa.CheckConstraint(
            "response IN ('going','maybe','not_going')", name="ck_event_rsvp_response"
        ),
        sa.CheckConstraint("guests >= 0", name="ck_event_rsvp_guests"),
    )
    op.create_index("ix_event_rsvps_community_id", "event_rsvps", ["community_id"])
    op.create_index("ix_event_rsvps_announcement_id", "event_rsvps", ["announcement_id"])
    op.create_index("ix_event_rsvps_response", "event_rsvps", ["response"])
    # tenant RLS, same policy shape as migration 0003
    op.execute("ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON event_rsvps USING (
            coalesce(current_setting('app.community_ids', true), '') = ''
            OR community_id IS NULL
            OR community_id::text = ANY (
                string_to_array(current_setting('app.community_ids', true), ',')
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON event_rsvps")
    op.drop_table("event_rsvps")

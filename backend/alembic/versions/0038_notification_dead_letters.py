"""M-02 remediation: notification_dead_letters — a durable record of a notification
dispatch/broadcast-enqueue that failed, so it can be retried instead of only logged.

Before this, `app/modules/notifications/events.py::emit`/`emit_many` and
`app/modules/communication/service.py::_enqueue_fan_out` caught any exception, logged a
warning, and returned — the failure was unrecoverable the moment the log line scrolled
past. RLS on this table follows the same convention as every other tenant table.

Revision ID: 0038_notification_dead_letters
Revises: 0037_amenity_capacity_guard
Create Date: 2026-09-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0038_notification_dead_letters"
down_revision = "0037_amenity_capacity_guard"
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
        "notification_dead_letters",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("notification_type", sa.String(60), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("failure_reason", sa.Text(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_attempted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
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
    op.create_index(
        "ix_notification_dead_letters_resolved_at",
        "notification_dead_letters",
        ["resolved_at"],
    )
    op.execute(_RLS.format(t="notification_dead_letters"))


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON notification_dead_letters;")
    op.drop_index(
        "ix_notification_dead_letters_resolved_at", table_name="notification_dead_letters"
    )
    op.drop_table("notification_dead_letters")

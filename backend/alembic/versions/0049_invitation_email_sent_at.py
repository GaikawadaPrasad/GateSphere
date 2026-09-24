"""Add email_sent_at idempotency stamp to community_invitations.

Fixes GS-BUG-006: invitation creation never actually sent an email — this column lets the
new `send_invitation_email` Celery task (app/modules/onboarding/tasks.py) mark the row once
the send has happened, so a retried/duplicated task never re-sends (AGENTS.md §9.3).

Revision ID: 0049_invitation_email_sent_at
Revises: 0048_sync_assoc_comm_rbac
Create Date: 2026-09-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0049_invitation_email_sent_at"
down_revision = "0048_sync_assoc_comm_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "community_invitations",
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("community_invitations", "email_sent_at")

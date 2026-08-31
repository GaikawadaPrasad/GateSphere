"""FR-01 multi-role sessions: independent named session cookies per role bucket.

Adds role/bucket/community/last-activity columns to `user_sessions` so one browser or
Postman cookie jar can hold several independent sessions (one per `gatesphere_<bucket>_session`
cookie) without one login overwriting another. Logout revokes only the presented session.

Revision ID: 0024_multi_role_sessions
Revises: 0023_rbac_onboarding
Create Date: 2026-08-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0024_multi_role_sessions"
down_revision = "0023_rbac_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_sessions", sa.Column("role_slug", sa.String(length=48), nullable=True))
    op.add_column("user_sessions", sa.Column("cookie_bucket", sa.String(length=48), nullable=True))
    op.add_column(
        "user_sessions",
        sa.Column("community_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "user_sessions",
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_sessions_role_slug", "user_sessions", ["role_slug"])
    # existing live sessions predate buckets — treat them as the legacy "default" bucket
    op.execute(
        "UPDATE user_sessions SET cookie_bucket = 'default', last_activity_at = created_at "
        "WHERE cookie_bucket IS NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_user_sessions_role_slug", table_name="user_sessions")
    op.drop_column("user_sessions", "last_activity_at")
    op.drop_column("user_sessions", "community_id")
    op.drop_column("user_sessions", "cookie_bucket")
    op.drop_column("user_sessions", "role_slug")

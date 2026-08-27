"""align audit_logs columns to ERD v1.2 / AGENTS.md §10 (FR-16)

Pre-release: the audit table is emptied and reshaped to the canonical column names
(created_at, user_id, session_id uuid, old_values, new_values, ip_address inet, user_agent).

Revision ID: 0005_audit_log_erd_shape
Revises: 0004_communities_property_erd
Create Date: 2026-08-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_audit_log_erd_shape"
down_revision = "0004_communities_property_erd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM audit_logs")
    op.alter_column("audit_logs", "at", new_column_name="created_at")
    op.alter_column("audit_logs", "actor_user_id", new_column_name="user_id")
    op.alter_column("audit_logs", "previous", new_column_name="old_values")
    op.alter_column("audit_logs", "current", new_column_name="new_values")
    op.drop_column("audit_logs", "ip")
    op.drop_column("audit_logs", "session_id")
    op.add_column("audit_logs", sa.Column("session_id", sa.Uuid()))
    op.add_column("audit_logs", sa.Column("ip_address", postgresql.INET()))
    op.add_column("audit_logs", sa.Column("user_agent", sa.String(512)))


def downgrade() -> None:
    op.execute("DELETE FROM audit_logs")
    op.drop_column("audit_logs", "user_agent")
    op.drop_column("audit_logs", "ip_address")
    op.drop_column("audit_logs", "session_id")
    op.add_column("audit_logs", sa.Column("session_id", sa.String(64)))
    op.add_column("audit_logs", sa.Column("ip", sa.String(64)))
    op.alter_column("audit_logs", "new_values", new_column_name="current")
    op.alter_column("audit_logs", "old_values", new_column_name="previous")
    op.alter_column("audit_logs", "user_id", new_column_name="actor_user_id")
    op.alter_column("audit_logs", "created_at", new_column_name="at")

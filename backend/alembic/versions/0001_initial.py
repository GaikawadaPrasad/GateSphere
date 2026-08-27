"""initial core schema: communities, property hierarchy, RBAC, audit

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-27
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _ts() -> tuple[sa.Column, sa.Column]:
    return (
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def upgrade() -> None:
    op.create_table(
        "communities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(32), nullable=False, unique=True),
        sa.Column("address", sa.String(1024)),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="Asia/Kolkata"),
        *_ts(),
    )
    op.create_table(
        "towers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("floors_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("community_id", "name"),
        *_ts(),
    )
    op.create_table(
        "floors",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tower_id",
            sa.Uuid(),
            sa.ForeignKey("towers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.UniqueConstraint("tower_id", "number"),
        *_ts(),
    )
    op.create_table(
        "units",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "tower_id",
            sa.Uuid(),
            sa.ForeignKey("towers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "floor_id",
            sa.Uuid(),
            sa.ForeignKey("floors.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String(32), nullable=False),
        sa.Column("unit_type", sa.String(32), nullable=False, server_default="apartment"),
        sa.Column("bedrooms", sa.Integer()),
        sa.UniqueConstraint("community_id", "label"),
        *_ts(),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("phone", sa.String(20), unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.false()),
        *_ts(),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.String(512)),
        *_ts(),
    )
    op.create_table(
        "permissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(128), nullable=False, unique=True, index=True),
        sa.Column("description", sa.String(512)),
    )
    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "permission_id",
            sa.Uuid(),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("role_id", "permission_id"),
    )
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            index=True,
        ),
        sa.UniqueConstraint("user_id", "role_id", "community_id"),
        *_ts(),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            index=True,
        ),
        sa.Column("community_id", sa.Uuid(), index=True),
        sa.Column("actor_user_id", sa.Uuid(), index=True),
        sa.Column("module", sa.String(64), nullable=False, index=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(64)),
        sa.Column("entity_id", sa.String(64)),
        sa.Column("previous", postgresql.JSONB()),
        sa.Column("current", postgresql.JSONB()),
        sa.Column("ip", sa.String(64)),
        sa.Column("session_id", sa.String(64)),
    )


def downgrade() -> None:
    for t in (
        "audit_logs",
        "user_roles",
        "role_permissions",
        "permissions",
        "roles",
        "users",
        "units",
        "floors",
        "towers",
        "communities",
    ):
        op.drop_table(t)

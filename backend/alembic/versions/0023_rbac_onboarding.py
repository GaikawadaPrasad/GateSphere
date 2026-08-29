"""Configurable RBAC (per-community role-permission overrides) + tenant onboarding
(community invitations) + `users.permission_version` for cache/session invalidation.

Revision ID: 0023_rbac_onboarding
Revises: 0022_managed_files
Create Date: 2026-08-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_rbac_onboarding"
down_revision = "0022_managed_files"
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


def _ts() -> tuple:
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
    op.add_column(
        "users",
        sa.Column("permission_version", sa.Integer(), server_default="0", nullable=False),
    )

    # --- per-community role-permission overrides -------------------------------
    op.create_table(
        "community_role_permissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "role_id", sa.Uuid(), sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "permission_id",
            sa.Uuid(),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("effect", sa.String(5), nullable=False),  # 'allow' | 'deny'
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("note", sa.String(255)),
        sa.CheckConstraint("effect IN ('allow', 'deny')", name="ck_crp_effect"),
        sa.UniqueConstraint("community_id", "role_id", "permission_id"),
        *_ts(),
    )
    op.execute(_RLS.format(t="community_role_permissions"))

    # --- tenant onboarding invitations ---------------------------------------
    op.create_table(
        "community_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("unit_id", sa.Uuid(), nullable=False),
        sa.Column("invited_email", sa.String(255), nullable=False),
        sa.Column("invited_phone", sa.String(20)),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role_slug", sa.String(64), server_default="resident", nullable=False),
        sa.Column("occupancy_role", sa.String(20), server_default="tenant", nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("agreement_reference", sa.String(120)),
        sa.Column("message", sa.Text()),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("status", sa.String(12), server_default="pending", nullable=False),
        sa.Column("invited_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("accepted_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "resident_profile_id",
            sa.Uuid(),
            sa.ForeignKey("resident_profiles.id", ondelete="SET NULL"),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')", name="ck_invitation_status"
        ),
        sa.ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        *_ts(),
    )
    op.create_index("ix_community_invitations_email", "community_invitations", ["invited_email"])
    op.execute(_RLS.format(t="community_invitations"))


def downgrade() -> None:
    op.drop_table("community_invitations")
    op.drop_table("community_role_permissions")
    op.drop_column("users", "permission_version")

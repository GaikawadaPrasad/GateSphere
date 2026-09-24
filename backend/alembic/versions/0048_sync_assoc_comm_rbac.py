"""Sync Association Committee role and RBAC.

Revision ID: 0048_sync_assoc_comm_rbac
Revises: 0047_delivery_protocol_fk
Create Date: 2026-09-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0048_sync_assoc_comm_rbac"
down_revision = "0047_delivery_protocol_fk"
branch_labels = None
depends_on = None

AC_PERMS = [
    "billing:view",
    "billing:create",
    "billing:approve",
    "billing:export",
    "communication:view",
    "communication:create",
    "communication:update",
    "communication:approve",
    "communities:view",
    "complaints:view",
    "residents:view",
    "incidents:view",
    "dashboards:view",
    "audit:view",
    "audit:export",
    "notifications:view",
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Ensure permissions exist
    for perm_code in AC_PERMS:
        mod, act = perm_code.split(":")
        desc = f"{act.title()} {mod.replace('_', ' ')}"
        conn.execute(
            sa.text("""
                INSERT INTO permissions (id, code, description)
                VALUES (gen_random_uuid(), :code, :desc)
                ON CONFLICT (code) DO NOTHING;
            """),
            {"code": perm_code, "desc": desc},
        )

    # 2. Ensure association_committee role exists
    conn.execute(
        sa.text("""
            INSERT INTO roles (id, slug, name, description)
            VALUES (
                gen_random_uuid(),
                'association_committee',
                'Association Committee — governance & oversight',
                'Community governance and financial oversight committee'
            )
            ON CONFLICT (slug) DO NOTHING;
        """)
    )

    # 3. Grant permissions to association_committee
    for perm_code in AC_PERMS:
        conn.execute(
            sa.text("""
                INSERT INTO role_permissions (id, role_id, permission_id)
                SELECT gen_random_uuid(), r.id, p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.slug = 'association_committee' AND p.code = :perm_code
                ON CONFLICT (role_id, permission_id) DO NOTHING;
            """),
            {"perm_code": perm_code},
        )

    # 4. Link demo association_committee user to user_roles with the first community
    conn.execute(
        sa.text("""
            INSERT INTO user_roles (id, user_id, role_id, community_id)
            SELECT gen_random_uuid(), u.id, r.id, c.id
            FROM users u
            CROSS JOIN roles r
            CROSS JOIN (SELECT id FROM communities ORDER BY created_at ASC LIMIT 1) c
            WHERE u.email = 'association_committee@gatesphere.com'
              AND r.slug = 'association_committee'
            ON CONFLICT (user_id, role_id, community_id) DO NOTHING;
        """)
    )

    # 5. Invalidate permission cache so active user sessions reload new grants
    conn.execute(sa.text("UPDATE users SET permission_version = permission_version + 1;"))


def downgrade() -> None:
    pass

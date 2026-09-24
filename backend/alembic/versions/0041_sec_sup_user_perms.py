"""Grant users:view, users:create, users:update to security_supervisor.

Revision ID: 0041_sec_sup_user_perms
Revises: 0040_secure_app_role_and_audit
Create Date: 2026-09-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0041_sec_sup_user_perms"
down_revision = "0040_secure_app_role_and_audit"
branch_labels = None
depends_on = None

NEW_ROLE_PERMS = [
    {"role_slug": "security_supervisor", "perm_code": "users:view"},
    {"role_slug": "security_supervisor", "perm_code": "users:create"},
    {"role_slug": "security_supervisor", "perm_code": "users:update"},
]


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            INSERT INTO role_permissions (id, role_id, permission_id)
            SELECT gen_random_uuid(), r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.slug = :role_slug AND p.code = :perm_code
            ON CONFLICT (role_id, permission_id) DO NOTHING;
            """),
        NEW_ROLE_PERMS,
    )
    conn.execute(sa.text("UPDATE users SET permission_version = permission_version + 1;"))


def downgrade() -> None:
    pass

"""Grant gate:view to resident.

Revision ID: 0042_resident_gate_view
Revises: 0041_sec_sup_user_perms
Create Date: 2026-09-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0042_resident_gate_view"
down_revision = "0041_sec_sup_user_perms"
branch_labels = None
depends_on = None

NEW_ROLE_PERMS = [
    {"role_slug": "resident", "perm_code": "gate:view"},
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

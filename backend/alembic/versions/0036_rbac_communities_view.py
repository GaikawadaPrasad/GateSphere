"""Grant communities:view to domestic_staff, resident, and vendor_technician roles.

Revision ID: 0036_rbac_communities_view
Revises: 0035_backfill_amenity_slots
Create Date: 2026-09-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0036_rbac_communities_view"
down_revision = "0035_backfill_amenity_slots"
branch_labels = None
depends_on = None

NEW_ROLE_PERMS = [
    {"role_slug": "resident", "perm_code": "communities:view"},
    {"role_slug": "domestic_staff", "perm_code": "communities:view"},
    {"role_slug": "vendor_technician", "perm_code": "communities:view"},
]


def upgrade() -> None:
    conn = op.get_bind()

    # Ensure communities:view is inserted into role_permissions for these roles
    conn.execute(
        sa.text(
            """
            INSERT INTO role_permissions (id, role_id, permission_id)
            SELECT gen_random_uuid(), r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.slug = :role_slug AND p.code = :perm_code
            ON CONFLICT (role_id, permission_id) DO NOTHING;
            """
        ),
        NEW_ROLE_PERMS,
    )

    # Invalidate permission cache so all active user sessions reload new grants immediately
    conn.execute(sa.text("UPDATE users SET permission_version = permission_version + 1;"))


def downgrade() -> None:
    pass

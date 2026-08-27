"""Row-Level Security on tenant tables (AGENTS.md §3, §23)

Defence-in-depth: even if a query forgets its community filter, PostgreSQL will not
return another community's rows to the application role.

Policy: allow when the request-scoped GUC `app.community_ids` is unset/empty (bootstrap,
migrations, superuser) OR when the row's `community_id` is in that comma-separated list.
The application sets the GUC per transaction via `app.core.tenancy.bind_rls_scope`.

Local dev connects as a Postgres superuser, which bypasses RLS entirely — this is
expected. RLS is verified by a dedicated suite that connects as the restricted role
against the migrated DB (see tests/test_tenant_isolation.py).

Revision ID: 0003_rls_tenant_isolation
Revises: 0002_user_sessions
Create Date: 2026-08-27
"""

from __future__ import annotations

from alembic import op

revision = "0003_rls_tenant_isolation"
down_revision = "0002_user_sessions"
branch_labels = None
depends_on = None

# Tenant tables that exist today. Extend as module tables land.
TENANT_TABLES = ["towers", "floors", "units", "user_roles", "audit_logs"]

_POLICY = """
CREATE POLICY tenant_isolation ON {table}
USING (
    coalesce(current_setting('app.community_ids', true), '') = ''
    OR community_id IS NULL
    OR community_id::text = ANY (
        string_to_array(current_setting('app.community_ids', true), ',')
    )
);
"""


def upgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(_POLICY.format(table=table))


def downgrade() -> None:
    for table in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

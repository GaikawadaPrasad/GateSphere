"""RLS fail-closed + child-table coverage + app-role hardening (re-audit #3, S-01 / S-06 / R-4).

1. **Fail-closed policies.** Every `tenant_isolation` policy used to allow *all* rows when
   the `app.community_ids` GUC was unset or empty. It is rewritten so an unset/empty GUC
   sees **nothing**; a global caller (Super Admin, system jobs) must bind the explicit
   sentinel `*` (`app.core.tenancy.bind_rls_scope_async`, `app.core.jobs.job_session`).
   `audit_logs` additionally hides platform-level (NULL-community) rows from a
   tenant-scoped reader, while still allowing such rows to be written.
2. **Child tables.** Tables without their own `community_id` (ticket/incident/delivery
   children, invoice items, poll rows, visitor approvals/passes, …) get a policy that
   inherits the parent's isolation: `EXISTS (SELECT 1 FROM <parent> WHERE id = <fk>)` —
   policies apply inside the sub-select, so a row is visible only if its parent is.
   `user_notification_preferences` gets the standard community policy.
   Identity / catalogue tables (`users`, `user_sessions`, `roles`, `permissions`,
   `role_permissions`, `communities`) stay without tenant RLS: they are read before any
   tenant scope exists (login, session lookup) and are not community-owned data.
3. **`gatesphere_app` role.** Migration 0040 originally set a hard-coded password. That
   literal was later removed from 0040's source, but databases already at 0040 keep it.
   This migration clears it (or sets it from `GATESPHERE_APP_DB_PASSWORD`), passing the
   secret as a bind parameter — no string-built SQL. It also narrows `audit_logs` to
   append-only for the role (no UPDATE / DELETE / TRUNCATE / TRIGGER).

The local / CI app role is a superuser and bypasses RLS; enforcement is proven by
`tests/test_tenant_isolation.py`, which connects as a NOSUPERUSER NOBYPASSRLS role.

Revision ID: 0045_rls_fail_closed
Revises: 0044_delivery_protocols
Create Date: 2026-09-24
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from alembic import op

revision = "0045_rls_fail_closed"
down_revision = "0044_delivery_protocols"
branch_labels = None
depends_on = None

_GUC = "current_setting('app.community_ids', true)"
_SCOPE_SET = f"COALESCE({_GUC}, '') <> ''"
_IS_GLOBAL = f"{_GUC} = '*'"
_IN_SCOPE = f"community_id::text = ANY (string_to_array({_GUC}, ','))"

# Read side hides NULL-community (platform-level) rows from tenant-scoped callers.
_READ_EXCLUDES_GLOBAL_ROWS = {"audit_logs"}

# child table -> (NOT NULL fk column, RLS-protected parent table)
_CHILD_TABLES: dict[str, tuple[str, str]] = {
    "announcement_targets": ("announcement_id", "announcements"),
    "delivery_events": ("delivery_id", "deliveries"),
    "incident_actions": ("incident_id", "security_incidents"),
    "incident_assignments": ("incident_id", "security_incidents"),
    "incident_attachments": ("incident_id", "security_incidents"),
    "invoice_items": ("invoice_id", "maintenance_invoices"),
    "notification_deliveries": ("notification_id", "notifications"),
    "payment_allocations": ("payment_id", "payments"),
    "poll_options": ("poll_id", "polls"),
    "poll_responses": ("poll_id", "polls"),
    # parent is itself a child (poll_responses -> polls); the chain is transitive.
    "poll_response_options": ("response_id", "poll_responses"),
    "resident_group_members": ("group_id", "resident_groups"),
    "ticket_assignments": ("ticket_id", "service_tickets"),
    "ticket_attachments": ("ticket_id", "service_tickets"),
    "ticket_feedback": ("ticket_id", "service_tickets"),
    "ticket_messages": ("ticket_id", "service_tickets"),
    "ticket_status_history": ("ticket_id", "service_tickets"),
    "visitor_approvals": ("request_id", "visitor_requests"),
    "visitor_passes": ("request_id", "visitor_requests"),
}

_NEW_COMMUNITY_TABLES = ["user_notification_preferences"]

# The pre-0045 (fail-open) policy, restored on downgrade.
_OLD_POLICY = (
    "CREATE POLICY tenant_isolation ON {t} USING ("
    f"COALESCE({_GUC}, '') = '' OR community_id IS NULL OR {_IN_SCOPE})"
)


def _community_policy(table: str) -> str:
    check = f"{_SCOPE_SET} AND ({_IS_GLOBAL} OR community_id IS NULL OR {_IN_SCOPE})"
    if table in _READ_EXCLUDES_GLOBAL_ROWS:
        using = f"{_SCOPE_SET} AND ({_IS_GLOBAL} OR {_IN_SCOPE})"
    else:
        using = check
    return f"CREATE POLICY tenant_isolation ON {table} USING ({using}) WITH CHECK ({check})"


def _child_policy(table: str, fk: str, parent: str) -> str:
    return (
        f"CREATE POLICY tenant_isolation ON {table} USING ("
        f"EXISTS (SELECT 1 FROM {parent} p WHERE p.id = {table}.{fk}))"
    )


def _existing_community_policy_tables(bind) -> list[str]:
    return list(
        bind.execute(
            sa.text(
                "SELECT p.tablename FROM pg_policies p "
                "WHERE p.schemaname = 'public' AND p.policyname = 'tenant_isolation' "
                "AND EXISTS (SELECT 1 FROM information_schema.columns c "
                "  WHERE c.table_schema = 'public' AND c.table_name = p.tablename "
                "  AND c.column_name = 'community_id') "
                "ORDER BY p.tablename"
            )
        ).scalars()
    )


def _role_exists(bind) -> bool:
    return bool(
        bind.execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = 'gatesphere_app'")).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    # 1. rewrite every existing community policy fail-closed
    for table in _existing_community_policy_tables(bind):
        op.execute(f"DROP POLICY tenant_isolation ON {table}")
        op.execute(_community_policy(table))

    # 2. new coverage
    for table in _NEW_COMMUNITY_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(_community_policy(table))
    for table, (fk, parent) in _CHILD_TABLES.items():
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(_child_policy(table, fk, parent))

    # 3. app role: rotate away the legacy hard-coded password, narrow audit grants
    if _role_exists(bind):
        password = os.getenv("GATESPHERE_APP_DB_PASSWORD") or os.getenv("APP_DB_PASSWORD")
        if password:
            # Secret travels as a bind parameter; format(%L) quotes it server-side.
            bind.execute(sa.text("SELECT set_config('gs.app_db_pw', :pw, true)"), {"pw": password})
            op.execute(
                "DO $$ BEGIN EXECUTE format('ALTER ROLE gatesphere_app PASSWORD %L', "
                "current_setting('gs.app_db_pw')); END $$"
            )
            op.execute("SELECT set_config('gs.app_db_pw', '', true)")
        else:
            op.execute("ALTER ROLE gatesphere_app PASSWORD NULL")
        op.execute("REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER ON audit_logs FROM gatesphere_app")


def downgrade() -> None:
    bind = op.get_bind()

    if _role_exists(bind):
        # The old password is deliberately NOT restored.
        op.execute("GRANT UPDATE, DELETE, TRUNCATE, TRIGGER ON audit_logs TO gatesphere_app")

    for table in _CHILD_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    for table in _NEW_COMMUNITY_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    for table in _existing_community_policy_tables(bind):
        op.execute(f"DROP POLICY tenant_isolation ON {table}")
        op.execute(_OLD_POLICY.format(t=table))

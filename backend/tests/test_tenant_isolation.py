"""RLS enforcement — connect as a **restricted** (non-superuser, NOBYPASSRLS) DB role and
prove the `tenant_isolation` policy actually filters rows.

The app's own DB user (`gatesphere`) is a superuser in the local image, so it *bypasses*
RLS — every other test verifies isolation via the repository `_scoped()` filter + cross-
tenant-404 API tests. This file closes that blind spot (AGENTS.md §12).
"""

from __future__ import annotations

import psycopg
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.db.session import SessionLocal
from app.modules.communities.models import Community

_RLS_USER = "gs_rls_test"
_RLS_PW = "gs_rls_test_pw"

# tenant tables that carry community_id + the tenant_isolation policy
_TENANT_TABLES = [
    "gates",
    "towers",
    "units",
    "resident_profiles",
    "visitors",
    "visitor_requests",
    "visitor_request_members",
    "gate_events",
    "domestic_staff",
    "deliveries",
    "vehicles",
    "maintenance_invoices",
    "service_tickets",
    "amenities",
    "announcements",
    "security_incidents",
    "notifications",
    "resident_groups",
    "managed_files",
]


def _admin_dsn() -> str:
    return str(settings.DATABASE_URL).replace("postgresql+psycopg://", "postgresql://")


def _restricted_dsn() -> str:
    hostpart = _admin_dsn().split("://", 1)[1].split("@", 1)[1]
    return f"postgresql://{_RLS_USER}:{_RLS_PW}@{hostpart}"


@pytest.fixture(scope="module")
def restricted_conn():
    with psycopg.connect(_admin_dsn(), autocommit=True) as admin:
        admin.execute(
            f"DO $$ BEGIN "
            f"  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{_RLS_USER}') THEN "
            f"    CREATE ROLE {_RLS_USER} LOGIN PASSWORD '{_RLS_PW}' NOSUPERUSER NOBYPASSRLS; "
            f"  END IF; END $$;"
        )
        admin.execute(f"GRANT USAGE ON SCHEMA public TO {_RLS_USER}")
        admin.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {_RLS_USER}"
        )
    conn = psycopg.connect(_restricted_dsn(), autocommit=True)
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def two_communities():
    with SessionLocal() as db:
        rows = db.scalars(
            select(Community).where(Community.code.in_(("gs-01", "gs-02"))).order_by(Community.code)
        ).all()
        if len(rows) < 2:
            rows = db.scalars(select(Community).order_by(Community.code)).all()
        return str(rows[0].id), str(rows[1].id)


def _visible_communities(conn, table: str, scoped_to: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT set_config(%s, %s, false)", ("app.community_ids", scoped_to))
        try:
            cur.execute(f"SELECT DISTINCT community_id::text FROM {table}")
            return {r[0] for r in cur.fetchall() if r[0] is not None}
        finally:
            cur.execute("SELECT set_config('app.community_ids', '', false)")


def test_restricted_role_does_not_bypass_rls(restricted_conn):
    with restricted_conn.cursor() as cur:
        cur.execute("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
        is_super, bypass = cur.fetchone()
    assert not is_super and not bypass


def test_scoped_guc_hides_other_communities(restricted_conn, two_communities):
    a, _b = two_communities
    leaks = {
        table: seen - {a}
        for table in _TENANT_TABLES
        if (seen := _visible_communities(restricted_conn, table, a)) - {a}
    }
    assert not leaks, f"RLS leak — restricted role scoped to {a} saw other communities: {leaks}"


def test_scope_actually_switches_the_visible_set(restricted_conn, two_communities):
    a, b = two_communities
    with restricted_conn.cursor() as cur:
        cur.execute("SELECT set_config(%s, %s, false)", ("app.community_ids", a))
        cur.execute("SELECT count(*) FROM units WHERE community_id = %s", (a,))
        own = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM units WHERE community_id = %s", (b,))
        cross = cur.fetchone()[0]
        cur.execute("SELECT set_config('app.community_ids', '', false)")
    assert own > 0  # the seed loaded units for community a
    assert cross == 0  # scoped to a, cannot see b's units


def test_write_outside_scope_is_blocked(restricted_conn, two_communities):
    a, b = two_communities
    with restricted_conn.cursor() as cur:
        cur.execute("SELECT set_config(%s, %s, false)", ("app.community_ids", a))
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute(
                "INSERT INTO resident_groups (id, community_id, name, created_at, updated_at) "
                "VALUES (gen_random_uuid(), %s, 'rls-probe', now(), now())",
                (b,),
            )
        cur.execute("SELECT set_config('app.community_ids', '', false)")


# --- migration 0045: fail-closed policies, child-table coverage, app-role hardening ------ #

# child table -> (fk column, parent table). Mirrors migration 0045.
_CHILD_TABLES = {
    "announcement_targets": ("announcement_id", "announcements"),
    "delivery_events": ("delivery_id", "deliveries"),
    "incident_actions": ("incident_id", "security_incidents"),
    "invoice_items": ("invoice_id", "maintenance_invoices"),
    "notification_deliveries": ("notification_id", "notifications"),
    "payment_allocations": ("payment_id", "payments"),
    "poll_options": ("poll_id", "polls"),
    "ticket_status_history": ("ticket_id", "service_tickets"),
    "ticket_messages": ("ticket_id", "service_tickets"),
    "visitor_approvals": ("request_id", "visitor_requests"),
    "visitor_passes": ("request_id", "visitor_requests"),
}


def _count(conn, sql: str, guc: str | None, params: tuple = ()) -> int:
    with conn.cursor() as cur:
        if guc is not None:
            cur.execute("SELECT set_config('app.community_ids', %s, false)", (guc,))
        try:
            cur.execute(sql, params)
            return cur.fetchone()[0]
        finally:
            cur.execute("SELECT set_config('app.community_ids', '', false)")


def test_unset_or_empty_scope_sees_nothing(restricted_conn):
    """Fail-closed: no bound scope => zero rows (re-audit #3, S-01)."""
    with psycopg.connect(_restricted_dsn(), autocommit=True) as fresh:  # GUC never set
        unset = {t: _count(fresh, f"SELECT count(*) FROM {t}", None) for t in _TENANT_TABLES}
    empty = {t: _count(restricted_conn, f"SELECT count(*) FROM {t}", "") for t in _TENANT_TABLES}
    assert not {t: n for t, n in unset.items() if n}, f"unset GUC leaked rows: {unset}"
    assert not {t: n for t, n in empty.items() if n}, f"empty GUC leaked rows: {empty}"


def test_global_sentinel_sees_every_community(restricted_conn, two_communities):
    a, b = two_communities
    seen = _visible_communities(restricted_conn, "units", "*")
    assert {a, b} <= seen


def test_child_tables_inherit_parent_isolation(restricted_conn, two_communities):
    a, _b = two_communities
    leaks: dict[str, tuple[int, int]] = {}
    with psycopg.connect(_admin_dsn(), autocommit=True) as admin:
        for table, (fk, parent) in _CHILD_TABLES.items():
            expected = admin.execute(
                f"SELECT count(*) FROM {table} c JOIN {parent} p ON p.id = c.{fk} "
                "WHERE p.community_id = %s",
                (a,),
            ).fetchone()[0]
            visible = _count(restricted_conn, f"SELECT count(*) FROM {table}", a)
            if visible != expected:
                leaks[table] = (visible, expected)
            assert _count(restricted_conn, f"SELECT count(*) FROM {table}", "") == 0, table
    assert not leaks, f"child-table RLS mismatch (visible, expected): {leaks}"


def test_scoped_reader_cannot_see_platform_audit_rows(restricted_conn, two_communities):
    a, _b = two_communities
    n = _count(restricted_conn, "SELECT count(*) FROM audit_logs WHERE community_id IS NULL", a)
    assert n == 0


def test_app_role_audit_logs_is_append_only():
    """`gatesphere_app` may INSERT/SELECT audit_logs but never UPDATE/DELETE/TRUNCATE."""
    with psycopg.connect(_admin_dsn(), autocommit=True) as admin:
        exists = admin.execute("SELECT 1 FROM pg_roles WHERE rolname = 'gatesphere_app'").fetchone()
        if not exists:
            pytest.fail("gatesphere_app role missing — migration 0040 not applied")
        for stmt in (
            "UPDATE audit_logs SET action = action WHERE false",
            "DELETE FROM audit_logs WHERE false",
            "TRUNCATE audit_logs",
        ):
            with admin.cursor() as cur:
                cur.execute("BEGIN")
                try:
                    cur.execute("SET LOCAL ROLE gatesphere_app")
                    with pytest.raises(psycopg.errors.InsufficientPrivilege):
                        cur.execute(stmt)
                finally:
                    cur.execute("ROLLBACK")


def test_app_role_has_no_legacy_password():
    """R-4: 0045 clears the hard-coded password on DBs migrated before 0040 was edited."""
    import os

    if os.getenv("GATESPHERE_APP_DB_PASSWORD") or os.getenv("APP_DB_PASSWORD"):
        pytest.skip("password intentionally supplied from a secret in this environment")
    with psycopg.connect(_admin_dsn(), autocommit=True) as admin:
        row = admin.execute(
            "SELECT rolpassword IS NULL FROM pg_authid WHERE rolname = 'gatesphere_app'"
        ).fetchone()
    assert row is not None and row[0] is True

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

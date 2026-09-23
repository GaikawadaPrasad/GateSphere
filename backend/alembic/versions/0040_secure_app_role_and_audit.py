"""Secure app DB role and audit logs
 
Revision ID: 0037_secure_app_role_and_audit
Revises: 0036_rbac_communities_view
Create Date: 2026-09-21
"""
 
from __future__ import annotations
 
import sqlalchemy as sa
from alembic import op
 
revision = "0040_secure_app_role_and_audit"
down_revision = "d13f12287d58"
branch_labels = None
depends_on = None
 
 
def upgrade() -> None:
    # 1. Create restricted app role without hardcoded credentials
    import os

    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gatesphere_app') THEN
            CREATE ROLE gatesphere_app WITH LOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
    END
    $$;
    """)

    app_db_password = os.getenv("GATESPHERE_APP_DB_PASSWORD") or os.getenv("APP_DB_PASSWORD")
    if app_db_password:
        safe_pw = app_db_password.replace("'", "''")
        op.execute(f"ALTER ROLE gatesphere_app WITH PASSWORD '{safe_pw}';")
    
    op.execute("GRANT USAGE ON SCHEMA public TO gatesphere_app;")
    op.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gatesphere_app;")
    op.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gatesphere_app;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gatesphere_app;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gatesphere_app;")

    # 2. Force RLS on all RLS-enabled tables in public schema only
    res = op.get_bind().execute(sa.text("""
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity = true;
    """))
    for (table,) in res:
        op.execute(f'ALTER TABLE public."{table}" FORCE ROW LEVEL SECURITY;')

    # 3. Create BEFORE TRUNCATE trigger on audit_logs
    op.execute("""
    CREATE OR REPLACE FUNCTION prevent_audit_truncate() RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'Truncation of audit_logs is strictly prohibited';
    END;
    $$ LANGUAGE plpgsql;
    """)
    op.execute("""
    DROP TRIGGER IF EXISTS tr_prevent_audit_truncate ON audit_logs;
    CREATE TRIGGER tr_prevent_audit_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_truncate();
    """)
    op.execute("REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM public;")
 
 
def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tr_prevent_audit_truncate ON audit_logs;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_truncate();")
    
    res = op.get_bind().execute(sa.text("""
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity = true;
    """))
    for (table,) in res:
        op.execute(f'ALTER TABLE public."{table}" NO FORCE ROW LEVEL SECURITY;')

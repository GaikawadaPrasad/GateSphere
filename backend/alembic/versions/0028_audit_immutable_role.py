"""FR-16 audit hardening: point-in-time `role_slug` + a DB trigger that makes
`audit_logs` genuinely append-only (AUD-1, AUD-2).

Before this, immutability was "no code path writes an UPDATE/DELETE" — a superuser or a
`psql` session could still tamper. The trigger RAISEs on any UPDATE or DELETE.

Revision ID: 0028_audit_immutable_role
Revises: 0027_canonical_index_names
Create Date: 2026-08-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0028_audit_immutable_role"
down_revision = "0027_canonical_index_names"
branch_labels = None
depends_on = None

_FN = """
CREATE OR REPLACE FUNCTION gs_audit_logs_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only (% blocked)', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("role_slug", sa.String(length=48), nullable=True))
    op.execute(_FN)
    op.execute(
        "CREATE TRIGGER gs_audit_logs_no_update BEFORE UPDATE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION gs_audit_logs_immutable()"
    )
    op.execute(
        "CREATE TRIGGER gs_audit_logs_no_delete BEFORE DELETE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION gs_audit_logs_immutable()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS gs_audit_logs_no_delete ON audit_logs")
    op.execute("DROP TRIGGER IF EXISTS gs_audit_logs_no_update ON audit_logs")
    op.execute("DROP FUNCTION IF EXISTS gs_audit_logs_immutable()")
    op.drop_column("audit_logs", "role_slug")

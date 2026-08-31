"""DB integrity (Stage 6): align index / unique-constraint names with what the models
declare, so `alembic revision --autogenerate` produces a clean (empty) diff.

Pure renames + two unique-constraint→unique-index conversions (same columns, same
uniqueness — no behavioural change). After this migration the model metadata and the live
schema agree on every index name.

Revision ID: 0027_canonical_index_names
Revises: 0026_db_integrity_indexes
Create Date: 2026-08-31
"""

from __future__ import annotations

from alembic import op

revision = "0027_canonical_index_names"
down_revision = "0026_db_integrity_indexes"
branch_labels = None
depends_on = None

# (old index name, new index name)
_RENAMES = [
    ("ix_community_invitations_email", "ix_community_invitations_invited_email"),
    ("ix_payments_status", "ix_payments_payment_status"),
    ("ix_staff_attendance_status", "ix_staff_attendance_attendance_status"),
]

# (table, column, old unique-constraint name, new unique-index name)
_CONSTRAINT_TO_INDEX = [
    ("communities", "code", "communities_code_key", "ix_communities_code"),
    (
        "community_invitations",
        "token_hash",
        "community_invitations_token_hash_key",
        "ix_community_invitations_token_hash",
    ),
]


def upgrade() -> None:
    for old, new in _RENAMES:
        op.execute(f'ALTER INDEX "{old}" RENAME TO "{new}"')
    for table, col, con, idx in _CONSTRAINT_TO_INDEX:
        op.drop_constraint(con, table, type_="unique")
        op.create_index(idx, table, [col], unique=True)


def downgrade() -> None:
    for table, col, con, idx in _CONSTRAINT_TO_INDEX:
        op.drop_index(idx, table_name=table)
        op.create_unique_constraint(con, table, [col])
    for old, new in _RENAMES:
        op.execute(f'ALTER INDEX "{new}" RENAME TO "{old}"')

"""DB integrity (Stage 6): add the indexes the models declare but earlier migrations
missed, an index for RLS-filtered `managed_files`, and a concurrency guard on gate entry.

- `community_invitations`: models declare `status` + `unit_id` as indexed; migration 0023
  created neither. `list_invitations` filters by `status`.
- `managed_files.community_id`: the table carries the `tenant_isolation` RLS policy, so every
  query gets `community_id IN (...)` appended — it needs an index.
- `uq_visitor_entry_open`: partial-unique matching the pattern already used for occupancy /
  staff assignment / parking — a request cannot have two open (`inside`) entries even under
  a race (the service already checks, this makes it atomic).

Revision ID: 0026_db_integrity_indexes
Revises: 0025_status_check_constraints
Create Date: 2026-08-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026_db_integrity_indexes"
down_revision = "0025_status_check_constraints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_community_invitations_status", "community_invitations", ["status"])
    op.create_index("ix_community_invitations_unit_id", "community_invitations", ["unit_id"])
    op.create_index("ix_managed_files_community_id", "managed_files", ["community_id"])
    op.create_index(
        "uq_visitor_entry_open",
        "visitor_entries",
        ["request_id"],
        unique=True,
        postgresql_where=sa.text("status = 'inside'"),
    )


def downgrade() -> None:
    op.drop_index("uq_visitor_entry_open", table_name="visitor_entries")
    op.drop_index("ix_managed_files_community_id", table_name="managed_files")
    op.drop_index("ix_community_invitations_unit_id", table_name="community_invitations")
    op.drop_index("ix_community_invitations_status", table_name="community_invitations")

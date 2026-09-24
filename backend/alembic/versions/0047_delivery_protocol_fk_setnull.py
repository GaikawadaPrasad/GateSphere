"""deliveries → delivery_protocols FK: null only `protocol_id` on delete (re-audit #4, N-9).

The composite tenant-safe FK `(protocol_id, community_id) → delivery_protocols(id,
community_id)` was `ON DELETE SET NULL`, which nulls **both** referencing columns. Deleting a
referenced protocol therefore tried to null `deliveries.community_id` (NOT NULL) and failed.
PostgreSQL 15+ supports a column list: `ON DELETE SET NULL (protocol_id)`.

Online-safe (see 0045): short `lock_timeout`, the new constraint is added `NOT VALID` (brief
lock, no scan) and validated separately (SHARE UPDATE EXCLUSIVE — reads and writes continue).

The ORM model keeps `ondelete="SET NULL"`: SQLAlchemy reflection reports the column-list form
as plain `SET NULL`, so model and database compare equal in the drift check.

Revision ID: 0047_delivery_protocol_fk
Revises: 0046_notif_simulated
Create Date: 2026-09-24
"""

from __future__ import annotations

from alembic import op

revision = "0047_delivery_protocol_fk"
down_revision = "0046_notif_simulated"
branch_labels = None
depends_on = None

_NAME = "deliveries_protocol_id_community_id_fkey"
_COLS = "(protocol_id, community_id) REFERENCES delivery_protocols (id, community_id)"


def _swap(on_delete: str) -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(f"ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS {_NAME}")
    op.execute(
        f"ALTER TABLE deliveries ADD CONSTRAINT {_NAME} FOREIGN KEY {_COLS} "
        f"ON DELETE {on_delete} NOT VALID"
    )
    # Validate in its own transaction: the brief exclusive lock above is released first, and
    # VALIDATE only takes SHARE UPDATE EXCLUSIVE while it scans.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.execute(f"ALTER TABLE deliveries VALIDATE CONSTRAINT {_NAME}")
        op.execute("RESET lock_timeout")


def upgrade() -> None:
    _swap("SET NULL (protocol_id)")


def downgrade() -> None:
    _swap("SET NULL")

"""merge heads

Revision ID: d13f12287d58
Revises: 0037_amenity_exclude_constraint, 0039_ticket_history_clock
Create Date: 2026-09-22 10:52:35.248254
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "d13f12287d58"
down_revision: str | None = ("0037_amenity_exclude_constraint", "0039_ticket_history_clock")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

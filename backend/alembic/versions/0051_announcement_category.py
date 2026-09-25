"""Add `category` to announcements (what a notice is about).

Lets each resident screen show only its own notices — the Maintenance tab lists
`maintenance` notices only; Community Notices shows the rest. Existing rows default to
`general`. The value set is pinned by a CHECK, like the other enum columns (0025).

Revision ID: 0051_announcement_category
Revises: 0050_violation_plate
Create Date: 2026-09-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0051_announcement_category"
down_revision = "0050_violation_plate"
branch_labels = None
depends_on = None

_CATEGORIES = ("general", "maintenance", "security", "amenities", "billing", "events")
_CHECK = "ck_announcements_category_valid"


def upgrade() -> None:
    op.add_column(
        "announcements",
        sa.Column("category", sa.String(length=15), nullable=False, server_default="general"),
    )
    op.create_index("ix_announcements_category", "announcements", ["category"])
    listed = ", ".join(f"'{c}'" for c in _CATEGORIES)
    op.create_check_constraint(_CHECK, "announcements", f"category IN ({listed})")


def downgrade() -> None:
    op.drop_constraint(_CHECK, "announcements", type_="check")
    op.drop_index("ix_announcements_category", table_name="announcements")
    op.drop_column("announcements", "category")

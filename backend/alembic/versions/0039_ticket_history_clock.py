"""Root-cause fix for the test_full_lifecycle_to_closed_needs_confirmation ordering
flake (backend/REMEDIATION_LOG.md).

`ticket_status_history.changed_at` defaulted to `now()`, which in PostgreSQL is the
*transaction* timestamp — frozen for every statement in that transaction. A ticket's
lifecycle test inserts 5-7 history rows inside one request/test transaction, so they all
got the identical `changed_at`, making `list_history`'s `ORDER BY changed_at` undefined
for ties. It only actually surfaced as a wrong order when the full suite had built up
enough unrelated rows in the table to change how Postgres broke that tie — passing in
isolation, occasionally failing in the full run. `clock_timestamp()` advances on every
call, even mid-transaction, giving each row a genuinely distinct, correctly-ordered value.

Revision ID: 0039_ticket_history_clock
Revises: 0038_notification_dead_letters
Create Date: 2026-09-22
"""

from __future__ import annotations

from alembic import op

revision = "0039_ticket_history_clock"
down_revision = "0038_notification_dead_letters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ticket_status_history ALTER COLUMN changed_at SET DEFAULT clock_timestamp();"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE ticket_status_history ALTER COLUMN changed_at SET DEFAULT now();")

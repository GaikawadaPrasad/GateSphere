"""Notification deliveries: add the `simulated` status (re-audit #3, S-08).

Mocked channels (SMS / WhatsApp / push / email in this build) were recorded as
`delivered`, which overstates what happened. New rows use `simulated`. Existing rows are
left untouched — `notification_deliveries` is append-only.

Revision ID: 0046_notif_simulated
Revises: 0045_rls_fail_closed
Create Date: 2026-09-24
"""

from __future__ import annotations

from alembic import op

revision = "0046_notif_simulated"
down_revision = "0045_rls_fail_closed"
branch_labels = None
depends_on = None

_NAME = "ck_notification_deliveries_status_valid"
_NEW = "status IN ('queued', 'sent', 'delivered', 'simulated', 'failed', 'skipped')"
_OLD = "status IN ('queued', 'sent', 'delivered', 'failed', 'skipped')"


def upgrade() -> None:
    op.execute(f"ALTER TABLE notification_deliveries DROP CONSTRAINT {_NAME}")
    op.execute(f"ALTER TABLE notification_deliveries ADD CONSTRAINT {_NAME} CHECK ({_NEW})")


def downgrade() -> None:
    # Rollback only: the old CHECK has no `simulated`; map those rows to the closest
    # pre-0046 meaning (`sent`, provider stays `simulated`) so the constraint can return.
    op.execute("UPDATE notification_deliveries SET status = 'sent' WHERE status = 'simulated'")
    op.execute(f"ALTER TABLE notification_deliveries DROP CONSTRAINT {_NAME}")
    op.execute(f"ALTER TABLE notification_deliveries ADD CONSTRAINT {_NAME} CHECK ({_OLD})")

"""gate / security operations (FR-05): gate_events, guard_rosters, gate_assignments,
panic_alerts. RLS on all four.

Revision ID: 0008_gate
Revises: 0007_visitors
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0008_gate"
down_revision = "0007_visitors"
branch_labels = None
depends_on = None

_RLS = """
ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {t}
USING (
    coalesce(current_setting('app.community_ids', true), '') = ''
    OR community_id IS NULL
    OR community_id::text = ANY (string_to_array(current_setting('app.community_ids', true), ','))
);
"""
_TENANT = ["gate_events", "guard_rosters", "gate_assignments", "panic_alerts"]


def _ts():
    return (
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def _community_col():
    return sa.Column(
        "community_id",
        sa.Uuid(),
        sa.ForeignKey("communities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


def upgrade() -> None:
    op.create_table(
        "gate_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("reference_type", sa.String(40)),
        sa.Column("reference_id", sa.Uuid()),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("metadata", JSONB()),
        *_ts(),
    )
    op.create_index("ix_gate_events_occurred_at", "gate_events", ["occurred_at"])
    op.create_index(
        "ix_gate_events_community_gate_time",
        "gate_events",
        ["community_id", "gate_id", "occurred_at"],
    )

    op.create_table(
        "guard_rosters",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column(
            "guard_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("supervisor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("shift_date", sa.Date(), nullable=False),
        sa.Column("shift_start", sa.Time(), nullable=False),
        sa.Column("shift_end", sa.Time(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="planned"),
        sa.Column("notes", sa.Text()),
        sa.UniqueConstraint("id", "community_id"),
        sa.UniqueConstraint(
            "community_id",
            "guard_user_id",
            "shift_date",
            "shift_start",
            name="uq_roster_guard_shift",
        ),
        *_ts(),
    )
    op.create_index("ix_guard_rosters_shift_date", "guard_rosters", ["shift_date"])
    op.create_index("ix_guard_rosters_status", "guard_rosters", ["status"])

    op.create_table(
        "gate_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column(
            "guard_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "gate_id",
            sa.Uuid(),
            sa.ForeignKey("gates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("roster_id", sa.Uuid(), sa.ForeignKey("guard_rosters.id", ondelete="SET NULL")),
        sa.Column(
            "assigned_from",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("assigned_to", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        *_ts(),
    )
    op.create_index("ix_gate_assignments_status", "gate_assignments", ["status"])

    op.create_table(
        "panic_alerts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _community_col(),
        sa.Column(
            "triggered_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column("alert_type", sa.String(12), nullable=False, server_default="other"),
        sa.Column("severity", sa.String(10), nullable=False, server_default="high"),
        sa.Column("message", sa.Text()),
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
        sa.Column(
            "triggered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "acknowledged_by_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_summary", sa.Text()),
        *_ts(),
    )
    op.create_index("ix_panic_alerts_status", "panic_alerts", ["status"])
    op.create_index("ix_panic_alerts_triggered_at", "panic_alerts", ["triggered_at"])

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in ("panic_alerts", "gate_assignments", "guard_rosters", "gate_events"):
        op.drop_table(t)

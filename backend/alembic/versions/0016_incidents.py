"""emergency & incident management (FR-13): security_incidents, incident_status_history,
incident_assignments, incident_actions. RLS on the two tenant tables.

Revision ID: 0016_incidents
Revises: 0015_communication
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016_incidents"
down_revision = "0015_communication"
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
_TENANT = ["security_incidents", "incident_status_history"]


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


def upgrade() -> None:
    op.create_table(
        "security_incidents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("incident_number", sa.String(40), nullable=False),
        sa.Column("incident_type", sa.String(20), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(15), nullable=False, server_default="reported"),
        sa.Column("tower_id", sa.Uuid(), sa.ForeignKey("towers.id", ondelete="SET NULL")),
        sa.Column("unit_id", sa.Uuid(), sa.ForeignKey("units.id", ondelete="SET NULL")),
        sa.Column("gate_id", sa.Uuid(), sa.ForeignKey("gates.id", ondelete="SET NULL")),
        sa.Column("location_text", sa.String(255)),
        sa.Column("reporter_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "panic_alert_id", sa.Uuid(), sa.ForeignKey("panic_alerts.id", ondelete="SET NULL")
        ),
        sa.Column("description", sa.Text()),
        sa.Column(
            "reported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("resolution_summary", sa.Text()),
        sa.UniqueConstraint("community_id", "incident_number"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )
    op.create_index("ix_security_incidents_severity", "security_incidents", ["severity"])
    op.create_index("ix_security_incidents_status", "security_incidents", ["status"])
    op.create_index("ix_security_incidents_reported_at", "security_incidents", ["reported_at"])

    op.create_table(
        "incident_status_history",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "incident_id",
            sa.Uuid(),
            sa.ForeignKey("security_incidents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("old_status", sa.String(15)),
        sa.Column("new_status", sa.String(15), nullable=False),
        sa.Column("changed_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reason", sa.Text()),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        *_ts(),
    )

    op.create_table(
        "incident_assignments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "incident_id",
            sa.Uuid(),
            sa.ForeignKey("security_incidents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "assigned_user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("assigned_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("released_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_ts(),
    )

    op.create_table(
        "incident_actions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "incident_id",
            sa.Uuid(),
            sa.ForeignKey("security_incidents.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action_type", sa.String(24), nullable=False),
        sa.Column("details", sa.Text()),
        sa.Column(
            "action_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        *_ts(),
    )
    op.create_index("ix_incident_actions_action_at", "incident_actions", ["action_at"])

    for t in _TENANT:
        op.execute(_RLS.format(t=t))


def downgrade() -> None:
    for t in (
        "incident_actions",
        "incident_assignments",
        "incident_status_history",
        "security_incidents",
    ):
        op.drop_table(t)

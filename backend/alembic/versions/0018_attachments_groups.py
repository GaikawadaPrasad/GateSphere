"""deferred child tables: ticket_attachments (FR-10), incident_attachments (FR-13),
resident_groups + resident_group_members (FR-12) — and a resident_group_id target column
on announcement_targets.

Revision ID: 0018_attachments_groups
Revises: 0017_notifications
Create Date: 2026-08-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0018_attachments_groups"
down_revision = "0017_notifications"
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


def _attachment(table: str, parent: str, parent_fk: str, extra_fk: tuple | None = None):
    cols = [
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            parent,
            sa.Uuid(),
            sa.ForeignKey(parent_fk, ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    ]
    if extra_fk:
        cols.append(
            sa.Column(extra_fk[0], sa.Uuid(), sa.ForeignKey(extra_fk[1], ondelete="SET NULL"))
        )
    cols += [
        sa.Column("uploaded_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(120)),
        sa.Column("file_size_bytes", sa.Integer()),
        *_ts(),
    ]
    op.create_table(table, *cols)


def upgrade() -> None:
    _attachment(
        "ticket_attachments",
        "ticket_id",
        "service_tickets.id",
        ("message_id", "ticket_messages.id"),
    )
    _attachment("incident_attachments", "incident_id", "security_incidents.id")

    op.create_table(
        "resident_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "community_id",
            sa.Uuid(),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("community_id", "name"),
        sa.UniqueConstraint("id", "community_id"),
        *_ts(),
    )

    op.create_table(
        "resident_group_members",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "group_id",
            sa.Uuid(),
            sa.ForeignKey("resident_groups.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("group_id", "user_id"),
        *_ts(),
    )

    op.add_column(
        "announcement_targets",
        sa.Column(
            "resident_group_id",
            sa.Uuid(),
            sa.ForeignKey("resident_groups.id", ondelete="CASCADE"),
        ),
    )
    op.drop_constraint("ck_announcement_target_valid", "announcement_targets", type_="check")
    op.create_check_constraint(
        "ck_announcement_target_valid",
        "announcement_targets",
        "target_all_community OR tower_id IS NOT NULL OR unit_id IS NOT NULL "
        "OR role_id IS NOT NULL OR resident_group_id IS NOT NULL",
    )

    op.execute(_RLS.format(t="resident_groups"))


def downgrade() -> None:
    op.drop_constraint("ck_announcement_target_valid", "announcement_targets", type_="check")
    op.create_check_constraint(
        "ck_announcement_target_valid",
        "announcement_targets",
        "target_all_community OR tower_id IS NOT NULL OR unit_id IS NOT NULL "
        "OR role_id IS NOT NULL",
    )
    op.drop_column("announcement_targets", "resident_group_id")
    op.drop_table("resident_group_members")
    op.drop_table("resident_groups")
    op.drop_table("incident_attachments")
    op.drop_table("ticket_attachments")

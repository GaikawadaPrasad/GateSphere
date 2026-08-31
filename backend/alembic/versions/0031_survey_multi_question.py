"""FR-12 GAP-1: multi-question surveys — a `survey` announcement carries one Poll
per question, so the uniqueness key moves from (announcement_id) to
(announcement_id, question).

Revision ID: 0031_survey_multi_question
Revises: 0030_event_rsvp
Create Date: 2026-08-31
"""

from __future__ import annotations

from alembic import op

revision = "0031_survey_multi_question"
down_revision = "0030_event_rsvp"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("polls_announcement_id_key", "polls", type_="unique")
    op.create_unique_constraint(
        "uq_poll_announcement_question", "polls", ["announcement_id", "question"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_poll_announcement_question", "polls", type_="unique")
    op.create_unique_constraint("polls_announcement_id_key", "polls", ["announcement_id"])

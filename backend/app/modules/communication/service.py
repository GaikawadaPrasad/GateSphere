"""Business logic for Communication & Broadcasts (FR-12).

- An announcement is editable while `is_published` is false; **publishing freezes it**
  (only `expire` may change it afterwards).
- Targets are validated against the announcement's community before publish.
- A poll is attached 1:1 to its announcement. Voting requires `status = open` and the poll's
  window; one response per user; `allow_multiple` gates multi-option selection.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.communication import schemas
from app.modules.communication.models import (
    Announcement,
    AnnouncementTarget,
    Poll,
    PollOption,
    PollResponse,
    PollResponseOption,
)
from app.modules.communication.repository import (
    AnnouncementRepository,
    PollRepository,
    response_count,
    response_for,
    tally,
)
from app.modules.communication.schemas import ALLOWED
from app.modules.communities.models import Tower, Unit
from app.modules.users.models import Role, User


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class CommunicationService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.announcements = AnnouncementRepository(db, scope)
        self.polls = PollRepository(db, scope)

    def _audit(self, action, community_id, entity_type, entity_id, **kw):
        record_audit(
            self.db,
            module="communication",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            request=self.request,
            **kw,
        )

    def _one_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    def _validate_targets(self, community_id: uuid.UUID, targets: list[schemas.TargetIn]) -> None:
        for t in targets:
            if t.tower_id is not None:
                tw = self.db.get(Tower, t.tower_id)
                if tw is None or tw.community_id != community_id:
                    raise NotFoundError("Tower not found")
            if t.unit_id is not None:
                un = self.db.get(Unit, t.unit_id)
                if un is None or un.community_id != community_id:
                    raise NotFoundError("Unit not found")
            if t.role_id is not None and self.db.get(Role, t.role_id) is None:
                raise NotFoundError("Role not found")

    def _apply_targets(self, ann: Announcement, targets: list[schemas.TargetIn]) -> None:
        ann.targets.clear()
        for t in targets:
            ann.targets.append(
                AnnouncementTarget(
                    tower_id=t.tower_id,
                    unit_id=t.unit_id,
                    role_id=t.role_id,
                    target_all_community=t.target_all_community,
                )
            )

    # -- announcements -------------------------------------- #
    def create_announcement(
        self, payload: schemas.AnnouncementCreate, *, community_id: uuid.UUID | None
    ) -> Announcement:
        cid = self._one_community(community_id)
        _enum("announcement_type", payload.announcement_type)
        _enum("priority", payload.priority)
        self._validate_targets(cid, payload.targets)
        ann = Announcement(
            community_id=cid,
            created_by_user_id=self.actor.id,
            announcement_type=payload.announcement_type,
            title=payload.title,
            body=payload.body,
            priority=payload.priority,
            publish_at=payload.publish_at,
            expires_at=payload.expires_at,
            event_start_at=payload.event_start_at,
            event_end_at=payload.event_end_at,
        )
        self._apply_targets(ann, payload.targets)
        self.announcements.add(ann)
        self._audit("announcement.create", cid, "announcement", ann.id)
        return ann

    def get_announcement(self, announcement_id: uuid.UUID) -> Announcement:
        obj = self.announcements.get(announcement_id)
        if obj is None:
            raise NotFoundError("Announcement not found")
        return obj

    def update_announcement(
        self, announcement_id: uuid.UUID, payload: schemas.AnnouncementUpdate
    ) -> Announcement:
        ann = self.get_announcement(announcement_id)
        if ann.is_published:
            raise BusinessRuleError(
                "A published announcement is immutable", code="ALREADY_PUBLISHED"
            )
        patch = payload.model_dump(exclude_unset=True)
        _enum("priority", patch.get("priority"))
        targets = patch.pop("targets", None)
        for k, v in patch.items():
            setattr(ann, k, v)
        if targets is not None:
            tlist = [schemas.TargetIn(**t) for t in targets]
            self._validate_targets(ann.community_id, tlist)
            self._apply_targets(ann, tlist)
        self.db.flush()
        self._audit("announcement.update", ann.community_id, "announcement", ann.id, new=patch)
        return ann

    def publish_announcement(self, announcement_id: uuid.UUID) -> Announcement:
        ann = self.get_announcement(announcement_id)
        if ann.is_published:
            raise BusinessRuleError("Already published", code="ALREADY_PUBLISHED")
        if not ann.targets:
            raise BusinessRuleError("Add at least one target before publishing", code="NO_TARGET")
        ann.is_published = True
        ann.publish_at = ann.publish_at or datetime.now(UTC)
        self.db.flush()
        self._audit("announcement.publish", ann.community_id, "announcement", ann.id)
        return ann

    def expire_announcement(self, announcement_id: uuid.UUID) -> Announcement:
        ann = self.get_announcement(announcement_id)
        ann.expires_at = datetime.now(UTC)
        self.db.flush()
        self._audit("announcement.expire", ann.community_id, "announcement", ann.id)
        return ann

    def list_announcements(
        self,
        *,
        community_id: uuid.UUID | None,
        published_only: bool,
        offset: int,
        limit: int,
    ):
        stmt = select(Announcement)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(Announcement.community_id == community_id)
        if published_only:
            stmt = stmt.where(Announcement.is_published.is_(True))
        stmt = stmt.order_by(Announcement.created_at.desc())
        return self.announcements.list(
            offset=offset, limit=limit, extra=stmt
        ), self.announcements.count(extra=stmt)

    # -- polls -------------------------------------------- #
    def create_poll(self, payload: schemas.PollCreate) -> Poll:
        ann = self.get_announcement(payload.announcement_id)
        if ann.announcement_type not in ("poll", "survey"):
            raise BusinessRuleError("Announcement is not a poll/survey", code="NOT_A_POLL")
        if self.polls.by_announcement(ann.id) is not None:
            raise ConflictError("That announcement already has a poll", code="POLL_EXISTS")
        poll = Poll(
            community_id=ann.community_id,
            announcement_id=ann.id,
            created_by_user_id=self.actor.id,
            question=payload.question,
            allow_multiple=payload.allow_multiple,
            opens_at=payload.opens_at,
            closes_at=payload.closes_at,
            status="draft",
        )
        for i, opt in enumerate(payload.options):
            poll.options.append(
                PollOption(option_text=opt.option_text, display_order=opt.display_order or i)
            )
        self.polls.add(poll)
        self._audit("poll.create", ann.community_id, "poll", poll.id)
        return poll

    def get_poll(self, poll_id: uuid.UUID) -> Poll:
        obj = self.polls.get(poll_id)
        if obj is None:
            raise NotFoundError("Poll not found")
        return obj

    def set_poll_status(self, poll_id: uuid.UUID, new_status: str) -> Poll:
        poll = self.get_poll(poll_id)
        _enum("poll_status", new_status)
        transitions = {"draft": {"open"}, "open": {"closed"}, "closed": set()}
        if new_status not in transitions[poll.status]:
            raise BusinessRuleError(
                f"Cannot move a '{poll.status}' poll to '{new_status}'", code="INVALID_TRANSITION"
            )
        if new_status == "open":
            if not poll.announcement.is_published:
                raise BusinessRuleError(
                    "Publish the announcement before opening the poll", code="ANNOUNCEMENT_DRAFT"
                )
            poll.opens_at = poll.opens_at or datetime.now(UTC)
        if new_status == "closed":
            poll.closes_at = datetime.now(UTC)
        poll.status = new_status
        self.db.flush()
        self._audit(f"poll.{new_status}", poll.community_id, "poll", poll.id)
        return poll

    def vote(self, poll_id: uuid.UUID, payload: schemas.VoteIn) -> PollResponse:
        poll = self.get_poll(poll_id)
        if poll.status != "open":
            raise BusinessRuleError("Poll is not open", code="POLL_NOT_OPEN")
        now = datetime.now(UTC)
        if poll.closes_at and now > poll.closes_at:
            raise BusinessRuleError("Poll has closed", code="POLL_CLOSED")
        opts = {o.id for o in poll.options}
        chosen = set(payload.option_ids)
        if not chosen.issubset(opts):
            raise BusinessRuleError("Unknown option", code="INVALID_OPTION")
        if not poll.allow_multiple and len(chosen) != 1:
            raise BusinessRuleError("Select exactly one option", code="SINGLE_CHOICE_ONLY")
        if response_for(self.db, poll.id, self.actor.id) is not None:
            raise ConflictError("You have already voted", code="ALREADY_VOTED")
        resp = PollResponse(poll_id=poll.id, user_id=self.actor.id)
        for oid in chosen:
            resp.selections.append(PollResponseOption(option_id=oid))
        self.db.add(resp)
        self.db.flush()
        self._audit("poll.vote", poll.community_id, "poll_response", resp.id)
        return resp

    def results(self, poll_id: uuid.UUID) -> schemas.PollResults:
        poll = self.get_poll(poll_id)
        counts = tally(self.db, poll.id)
        rows = [
            schemas.PollResultRow(
                option_id=o.id, option_text=o.option_text, votes=counts.get(o.id, 0)
            )
            for o in sorted(poll.options, key=lambda x: x.display_order)
        ]
        return schemas.PollResults(
            poll_id=poll.id, total_responses=response_count(self.db, poll.id), results=rows
        )

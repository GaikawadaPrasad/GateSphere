"""Unit tests — CommunicationService: publish freeze, poll lifecycle, voting."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.modules.communication import schemas
from app.modules.communication.service import CommunicationService
from app.modules.notifications.models import NotificationDeadLetter


def _svc(db, scope, actor):
    return CommunicationService(db, scope, actor)


async def _announcement(svc, community, atype="notice"):
    return await svc.create_announcement(
        schemas.AnnouncementCreate(
            announcement_type=atype,
            title="Water shutdown",
            body="No water 10-12",
            targets=[schemas.TargetIn(target_all_community=True)],
        ),
        community_id=community.id,
    )


async def test_publish_freezes_the_announcement(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    ann = await _announcement(svc, community)
    await svc.publish_announcement(ann.id)
    assert ann.is_published and ann.publish_at is not None
    with pytest.raises(BusinessRuleError) as exc:
        await svc.update_announcement(ann.id, schemas.AnnouncementUpdate(title="edited"))
    assert exc.value.code == "ALREADY_PUBLISHED"


async def test_publish_dead_letters_when_broker_enqueue_fails(
    db, scope_for, community, superadmin, monkeypatch
):
    """M-02 (backend/REMEDIATION_LOG.md): a Celery broker outage during the fan-out
    enqueue must not fail the publish (the announcement row is already committed) and
    must leave a `NotificationDeadLetter` (kind="broadcast_enqueue") instead of only a
    log line, so `retry_dead_letters` can re-enqueue it later."""
    from app.modules.communication.tasks import fan_out_announcement

    def _boom(*a, **k):
        raise RuntimeError("broker unreachable")

    monkeypatch.setattr(fan_out_announcement, "apply_async", _boom)

    svc = _svc(db, scope_for(community.id), superadmin)
    ann = await _announcement(svc, community)
    await svc.publish_announcement(ann.id)  # must not raise
    assert ann.is_published

    row = await db.scalar(
        select(NotificationDeadLetter).where(
            NotificationDeadLetter.notification_type == "communication.fan_out",
            NotificationDeadLetter.payload["announcement_id"].astext == str(ann.id),
        )
    )
    assert row is not None
    assert row.kind == "broadcast_enqueue"
    assert row.resolved_at is None


async def test_publish_requires_a_target(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    ann = await svc.create_announcement(
        schemas.AnnouncementCreate(title="x", body="y"), community_id=community.id
    )
    with pytest.raises(BusinessRuleError) as exc:
        await svc.publish_announcement(ann.id)
    assert exc.value.code == "NO_TARGET"


async def _poll(svc, community, superadmin, *, allow_multiple=False):
    ann = await _announcement(svc, community, atype="poll")
    await svc.publish_announcement(ann.id)
    poll = await svc.create_poll(
        schemas.PollCreate(
            announcement_id=ann.id,
            question="Pick a day",
            allow_multiple=allow_multiple,
            options=[
                schemas.PollOptionIn(option_text="Sat"),
                schemas.PollOptionIn(option_text="Sun"),
            ],
        )
    )
    return poll


async def test_poll_status_machine_and_open_requires_published(
    db, scope_for, community, superadmin
):
    svc = _svc(db, scope_for(community.id), superadmin)
    ann = await _announcement(svc, community, atype="poll")
    poll = await svc.create_poll(
        schemas.PollCreate(
            announcement_id=ann.id,
            question="Q",
            options=[
                schemas.PollOptionIn(option_text="A"),
                schemas.PollOptionIn(option_text="B"),
            ],
        )
    )
    with pytest.raises(BusinessRuleError) as exc:
        await svc.set_poll_status(poll.id, "open")
    assert exc.value.code == "ANNOUNCEMENT_DRAFT"


async def test_voting_rules(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    poll = await _poll(svc, community, superadmin)
    with pytest.raises(BusinessRuleError) as exc:  # not open yet
        await svc.vote(poll.id, schemas.VoteIn(option_ids=[poll.options[0].id]))
    assert exc.value.code == "POLL_NOT_OPEN"

    await svc.set_poll_status(poll.id, "open")
    voter = await make_user()
    vsvc = _svc(db, scope_for(community.id), voter)
    with pytest.raises(BusinessRuleError) as exc:  # single-choice poll, 2 options
        await vsvc.vote(poll.id, schemas.VoteIn(option_ids=[o.id for o in poll.options]))
    assert exc.value.code == "SINGLE_CHOICE_ONLY"

    await vsvc.vote(poll.id, schemas.VoteIn(option_ids=[poll.options[0].id]))
    with pytest.raises(ConflictError):
        await vsvc.vote(poll.id, schemas.VoteIn(option_ids=[poll.options[1].id]))

    res = await svc.results(poll.id)
    assert res.total_responses == 1
    assert sum(r.votes for r in res.results) == 1


async def test_closed_poll_rejects_votes(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    poll = await _poll(svc, community, superadmin)
    await svc.set_poll_status(poll.id, "open")
    await svc.set_poll_status(poll.id, "closed")
    v = _svc(db, scope_for(community.id), (await make_user()))
    with pytest.raises(BusinessRuleError) as exc:
        await v.vote(poll.id, schemas.VoteIn(option_ids=[poll.options[0].id]))
    assert exc.value.code == "POLL_NOT_OPEN"


# -- GS-010 / GS-021 / GS-022: list status filter + resident draft isolation -- #
async def _seed_three(svc, community):
    """One draft, one live published, one published-then-expired announcement."""
    draft = await _announcement(svc, community)
    live = await _announcement(svc, community)
    await svc.publish_announcement(live.id)
    expired = await _announcement(svc, community)
    await svc.publish_announcement(expired.id)
    await svc.expire_announcement(expired.id)
    return draft, live, expired


async def _ids(svc, community, **kw):
    rows, total = await svc.list_announcements(community_id=community.id, offset=0, limit=100, **kw)
    assert total == len(rows)
    return {r.id for r in rows}


async def test_list_status_filter_separates_draft_published_expired(
    db, scope_for, community, superadmin
):
    svc = _svc(db, scope_for(community.id), superadmin)
    draft, live, expired = await _seed_three(svc, community)

    assert await _ids(svc, community, published_only=True, status="all") == {
        draft.id,
        live.id,
        expired.id,
    }
    assert await _ids(svc, community, published_only=True, status="published") == {live.id}
    assert await _ids(svc, community, published_only=True, status="draft") == {draft.id}
    assert await _ids(svc, community, published_only=True, status="expired") == {expired.id}
    # Legacy default (no status) is unchanged: every published row, expired included.
    assert await _ids(svc, community, published_only=True) == {live.id, expired.id}


async def test_resident_never_sees_drafts_whatever_filter_is_sent(
    db, scope_for, community, superadmin, make_user
):
    draft, live, expired = await _seed_three(
        _svc(db, scope_for(community.id), superadmin), community
    )
    # A plain user with no cross-unit role is unit-restricted (resident semantics).
    resident = _svc(db, scope_for(community.id), await make_user())

    for status in (None, "all", "draft"):
        seen = await _ids(resident, community, published_only=False, status=status)
        assert draft.id not in seen
    assert await _ids(resident, community, published_only=False, status="draft") == set()

    with pytest.raises(NotFoundError):
        await resident.get_visible_announcement(draft.id)
    assert (await resident.get_visible_announcement(live.id)).id == live.id

"""Unit tests — CommunicationService: publish freeze, poll lifecycle, voting."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.communication import schemas
from app.modules.communication.service import CommunicationService


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

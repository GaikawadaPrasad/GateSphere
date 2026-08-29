"""Unit tests — GateService rules: append-only events, roster/assignment/alert machines."""

from __future__ import annotations

from datetime import date, time

import pytest

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError
from app.modules.gate import schemas
from app.modules.gate.service import GateService


def _svc(db, scope, actor):
    return GateService(db, scope, actor)


async def test_log_event_derives_community_from_gate(db, scope_for, community, gate, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    ev = await svc.log_event(schemas.EventCreate(gate_id=gate.id, event_type="gate_open"))
    assert ev.community_id == community.id
    assert ev.occurred_at is not None


async def test_bad_event_type_rejected(db, scope_for, community, gate, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    with pytest.raises(BusinessRuleError) as exc:
        await svc.log_event(schemas.EventCreate(gate_id=gate.id, event_type="teleport"))
    assert exc.value.code == "INVALID_ENUM"


async def _roster(svc, community, guard, **kw):
    payload = schemas.RosterCreate(
        guard_user_id=guard.id,
        shift_date=kw.pop("shift_date", date(2026, 9, 1)),
        shift_start=kw.pop("shift_start", time(8, 0)),
        shift_end=kw.pop("shift_end", time(20, 0)),
        **kw,
    )
    return await svc.create_roster(payload, community_id=community.id)


async def test_roster_status_machine(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    roster = await _roster(svc, community, (await make_user()))
    assert roster.status == "planned"
    await svc.transition_roster(roster.id, "active")
    with pytest.raises(BusinessRuleError) as exc:
        await svc.transition_roster(roster.id, "planned")
    assert exc.value.code == "INVALID_TRANSITION"
    await svc.transition_roster(roster.id, "completed")
    with pytest.raises(BusinessRuleError):  # completed is terminal
        await svc.transition_roster(roster.id, "active")


async def test_duplicate_roster_conflicts(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    guard = await make_user()
    await _roster(svc, community, guard)
    with pytest.raises(ConflictError):
        await _roster(svc, community, guard)


async def test_one_active_assignment_per_guard(
    db, scope_for, community, gate, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    guard = await make_user()
    await svc.create_assignment(
        schemas.AssignmentCreate(guard_user_id=guard.id, gate_id=gate.id),
        community_id=community.id,
    )
    with pytest.raises(ConflictError) as exc:
        await svc.create_assignment(
            schemas.AssignmentCreate(guard_user_id=guard.id, gate_id=gate.id),
            community_id=community.id,
        )
    assert exc.value.code == "ASSIGNMENT_ACTIVE"


async def test_end_assignment_frees_the_guard(
    db, scope_for, community, gate, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    guard = await make_user()
    a = await svc.create_assignment(
        schemas.AssignmentCreate(guard_user_id=guard.id, gate_id=gate.id),
        community_id=community.id,
    )
    ended = await svc.end_assignment(a.id)
    assert ended.status == "ended" and ended.assigned_to is not None
    # can assign again now
    await svc.create_assignment(
        schemas.AssignmentCreate(guard_user_id=guard.id, gate_id=gate.id),
        community_id=community.id,
    )


async def test_panic_alert_lifecycle(db, scope_for, community, gate, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    alert = await svc.raise_alert(
        schemas.AlertCreate(alert_type="fire", severity="critical", gate_id=gate.id)
    )
    assert alert.status == "active"
    ack = await svc.acknowledge_alert(alert.id)
    assert ack.status == "acknowledged" and ack.acknowledged_at is not None
    resolved = await svc.resolve_alert(alert.id, schemas.AlertResolve(resolution_summary="handled"))
    assert resolved.status == "resolved" and resolved.resolved_at is not None
    with pytest.raises(BusinessRuleError):
        await svc.acknowledge_alert(alert.id)


async def test_only_owner_cancels_alert(db, scope_for, community, superadmin, make_user):
    owner_scope = scope_for(community.id)
    other = await make_user()
    alert = await GateService(db, owner_scope, other).raise_alert(
        schemas.AlertCreate(community_id=community.id)
    )
    with pytest.raises(ForbiddenError) as exc:
        await GateService(db, owner_scope, superadmin).cancel_alert(alert.id)
    assert exc.value.code == "NOT_ALERT_OWNER"
    await GateService(db, owner_scope, other).cancel_alert(alert.id)

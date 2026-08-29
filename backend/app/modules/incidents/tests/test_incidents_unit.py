"""Unit tests — IncidentService: lifecycle, resolve gate, assignments, action log."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.modules.incidents import schemas
from app.modules.incidents.service import IncidentService


def _svc(db, scope, actor):
    return IncidentService(db, scope, actor)


async def _incident(svc, community, **kw):
    return await svc.create_incident(
        schemas.IncidentCreate(
            incident_type=kw.pop("incident_type", "fire"),
            severity=kw.pop("severity", "high"),
            community_id=community.id,
            **kw,
        )
    )


async def test_incident_number_and_initial_history(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = await _incident(svc, community)
    assert inc.incident_number.startswith("INC-") and inc.status == "reported"
    assert [h.new_status for h in await svc.list_history(inc.id)] == ["reported"]


async def test_lifecycle_and_resolve_requires_summary(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = await _incident(svc, community)
    await svc.transition_incident(inc.id, schemas.IncidentTransition(status="acknowledged"))
    await svc.transition_incident(inc.id, schemas.IncidentTransition(status="responding"))
    with pytest.raises(BusinessRuleError) as exc:
        await svc.transition_incident(inc.id, schemas.IncidentTransition(status="resolved"))
    assert exc.value.code == "SUMMARY_REQUIRED"
    await svc.transition_incident(
        inc.id,
        schemas.IncidentTransition(status="resolved", resolution_summary="Extinguished"),
    )
    assert inc.status == "resolved" and inc.resolved_at is not None
    await svc.transition_incident(inc.id, schemas.IncidentTransition(status="closed"))
    assert inc.status == "closed"
    with pytest.raises(BusinessRuleError):
        await svc.transition_incident(inc.id, schemas.IncidentTransition(status="responding"))


async def test_bad_transition_rejected(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = await _incident(svc, community)
    with pytest.raises(BusinessRuleError) as exc:
        await svc.transition_incident(inc.id, schemas.IncidentTransition(status="resolved"))
    assert exc.value.code == "INVALID_TRANSITION"


async def test_assign_and_release(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = await _incident(svc, community)
    responder = await make_user(community)
    a = await svc.assign(inc.id, schemas.AssignIn(assigned_user_id=responder.id))
    with pytest.raises(ConflictError):
        await svc.assign(inc.id, schemas.AssignIn(assigned_user_id=responder.id))
    # a user outside the community cannot be assigned as a responder
    outsider = await make_user()
    with pytest.raises(NotFoundError):
        await svc.assign(inc.id, schemas.AssignIn(assigned_user_id=outsider.id))
    released = await svc.release(a.id)
    assert released.is_active is False and released.released_at is not None


async def test_action_log_is_appended(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = await _incident(svc, community)
    await svc.add_action(inc.id, schemas.ActionIn(action_type="dispatch", details="Team A sent"))
    await svc.add_action(inc.id, schemas.ActionIn(action_type="authority_contacted"))
    log = await svc.list_actions(inc.id)
    assert [a.action_type for a in log] == ["dispatch", "authority_contacted"]

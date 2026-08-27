"""Unit tests — IncidentService: lifecycle, resolve gate, assignments, action log."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.incidents import schemas
from app.modules.incidents.service import IncidentService


def _svc(db, scope, actor):
    return IncidentService(db, scope, actor)


def _incident(svc, community, **kw):
    return svc.create_incident(
        schemas.IncidentCreate(
            incident_type=kw.pop("incident_type", "fire"),
            severity=kw.pop("severity", "high"),
            community_id=community.id,
            **kw,
        )
    )


def test_incident_number_and_initial_history(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = _incident(svc, community)
    assert inc.incident_number.startswith("INC-") and inc.status == "reported"
    assert [h.new_status for h in svc.list_history(inc.id)] == ["reported"]


def test_lifecycle_and_resolve_requires_summary(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = _incident(svc, community)
    svc.transition_incident(inc.id, schemas.IncidentTransition(status="acknowledged"))
    svc.transition_incident(inc.id, schemas.IncidentTransition(status="responding"))
    with pytest.raises(BusinessRuleError) as exc:
        svc.transition_incident(inc.id, schemas.IncidentTransition(status="resolved"))
    assert exc.value.code == "SUMMARY_REQUIRED"
    svc.transition_incident(
        inc.id,
        schemas.IncidentTransition(status="resolved", resolution_summary="Extinguished"),
    )
    assert inc.status == "resolved" and inc.resolved_at is not None
    svc.transition_incident(inc.id, schemas.IncidentTransition(status="closed"))
    assert inc.status == "closed"
    with pytest.raises(BusinessRuleError):
        svc.transition_incident(inc.id, schemas.IncidentTransition(status="responding"))


def test_bad_transition_rejected(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = _incident(svc, community)
    with pytest.raises(BusinessRuleError) as exc:
        svc.transition_incident(inc.id, schemas.IncidentTransition(status="resolved"))
    assert exc.value.code == "INVALID_TRANSITION"


def test_assign_and_release(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = _incident(svc, community)
    responder = make_user()
    a = svc.assign(inc.id, schemas.AssignIn(assigned_user_id=responder.id))
    with pytest.raises(ConflictError):
        svc.assign(inc.id, schemas.AssignIn(assigned_user_id=responder.id))
    released = svc.release(a.id)
    assert released.is_active is False and released.released_at is not None


def test_action_log_is_appended(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    inc = _incident(svc, community)
    svc.add_action(inc.id, schemas.ActionIn(action_type="dispatch", details="Team A sent"))
    svc.add_action(inc.id, schemas.ActionIn(action_type="authority_contacted"))
    log = svc.list_actions(inc.id)
    assert [a.action_type for a in log] == ["dispatch", "authority_contacted"]

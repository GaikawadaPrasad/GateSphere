"""Unit tests — ResidentService business rules in isolation."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.modules.residents import schemas
from app.modules.residents.service import ResidentService


def _svc(db, scope, actor):
    return ResidentService(db, scope, actor)


def _profile(svc, community_id, user):
    return svc.create_profile(
        schemas.ResidentProfileCreate(user_id=user.id), community_id=community_id
    )


def test_duplicate_profile_for_user_conflicts(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    user = make_user()
    _profile(svc, community.id, user)
    with pytest.raises(ConflictError) as exc:
        _profile(svc, community.id, user)
    assert exc.value.code == "PROFILE_EXISTS"


def test_bad_profile_status_is_invalid_enum(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    payload = schemas.ResidentProfileCreate(user_id=make_user().id, profile_status="haunted")
    with pytest.raises(BusinessRuleError) as exc:
        svc.create_profile(payload, community_id=community.id)
    assert exc.value.code == "INVALID_ENUM"


def test_occupancy_second_primary_conflicts(db, scope_for, community, unit, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    p1 = _profile(svc, community.id, make_user())
    p2 = _profile(svc, community.id, make_user())
    svc.create_occupancy(
        schemas.OccupancyCreate(
            unit_id=unit.id,
            resident_profile_id=p1.id,
            occupancy_role="primary_owner",
            is_primary=True,
        )
    )
    with pytest.raises(ConflictError) as exc:
        svc.create_occupancy(
            schemas.OccupancyCreate(
                unit_id=unit.id, resident_profile_id=p2.id, occupancy_role="tenant", is_primary=True
            )
        )
    assert exc.value.code == "PRIMARY_OCCUPANT_EXISTS"


def test_occupancy_on_unit_outside_scope_is_404(
    db, scope_for, community, unit, superadmin, make_user
):
    owner = _svc(db, scope_for(community.id), superadmin)
    profile = _profile(owner, community.id, make_user())
    other = _svc(db, scope_for(uuid.uuid4()), superadmin)
    with pytest.raises(NotFoundError):
        other.create_occupancy(
            schemas.OccupancyCreate(
                unit_id=unit.id, resident_profile_id=profile.id, occupancy_role="tenant"
            )
        )


def test_end_occupancy_bad_date_range(db, scope_for, community, unit, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    p = _profile(svc, community.id, make_user())
    occ = svc.create_occupancy(
        schemas.OccupancyCreate(unit_id=unit.id, resident_profile_id=p.id, occupancy_role="tenant")
    )
    with pytest.raises(BusinessRuleError) as exc:
        svc.end_occupancy(occ.id, schemas.OccupancyEnd(end_date=occ.start_date))
    assert exc.value.code == "INVALID_DATE_RANGE"


def test_move_record_invalid_transition(db, scope_for, community, unit, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    p = _profile(svc, community.id, make_user())
    mr = svc.create_move(
        schemas.MoveRecordCreate(unit_id=unit.id, resident_profile_id=p.id, move_type="move_in")
    )
    assert mr.status == "requested"
    with pytest.raises(BusinessRuleError) as exc:
        svc.transition_move(mr.id, schemas.MoveRecordTransition(status="completed"))
    assert exc.value.code == "INVALID_TRANSITION"


def test_move_approve_then_complete_deactivates_occupancy(
    db, scope_for, community, unit, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    p = _profile(svc, community.id, make_user())
    occ = svc.create_occupancy(
        schemas.OccupancyCreate(unit_id=unit.id, resident_profile_id=p.id, occupancy_role="tenant")
    )
    mr = svc.create_move(
        schemas.MoveRecordCreate(unit_id=unit.id, resident_profile_id=p.id, move_type="move_out")
    )
    svc.transition_move(mr.id, schemas.MoveRecordTransition(status="scheduled"))
    mr = svc.transition_move(mr.id, schemas.MoveRecordTransition(status="approved"))
    assert mr.approved_by_user_id == superadmin.id and mr.approved_at is not None
    svc.transition_move(mr.id, schemas.MoveRecordTransition(status="completed"))
    db.refresh(occ)
    assert occ.is_active is False


def test_family_member_relationship_alias(db, scope_for, community, unit, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    p = _profile(svc, community.id, make_user())
    fm = svc.create_family(
        schemas.FamilyMemberCreate.model_validate(
            {
                "unit_id": str(unit.id),
                "primary_resident_profile_id": str(p.id),
                "full_name": "Junior",
                "relationship": "child",
            }
        )
    )
    assert fm.relationship_type == "child"


def test_occupancy_start_before_end_when_ended(
    db, scope_for, community, unit, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    p = _profile(svc, community.id, make_user())
    occ = svc.create_occupancy(
        schemas.OccupancyCreate(unit_id=unit.id, resident_profile_id=p.id, occupancy_role="tenant")
    )
    ended = svc.end_occupancy(
        occ.id, schemas.OccupancyEnd(end_date=date.today() + timedelta(days=30))
    )
    assert ended.is_active is False and ended.end_date > ended.start_date


def test_profile_and_kyc_status_are_guarded(db, scope_for, community, superadmin, make_user):
    svc = _svc(db, scope_for(community.id), superadmin)
    p = _profile(svc, community.id, make_user())
    assert p.profile_status == "pending" and p.kyc_status == "not_started"

    # forward is fine
    svc.update_profile(p.id, schemas.ResidentProfileUpdate(profile_status="active"))
    svc.update_profile(p.id, schemas.ResidentProfileUpdate(kyc_status="submitted"))
    svc.update_profile(p.id, schemas.ResidentProfileUpdate(kyc_status="verified"))

    # illegal jumps rejected
    with pytest.raises(BusinessRuleError) as exc:
        svc.update_profile(p.id, schemas.ResidentProfileUpdate(profile_status="pending"))
    assert exc.value.code == "INVALID_TRANSITION"
    with pytest.raises(BusinessRuleError):
        svc.update_profile(p.id, schemas.ResidentProfileUpdate(kyc_status="not_started"))

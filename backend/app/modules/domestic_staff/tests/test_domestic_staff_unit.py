"""Unit tests — DomesticStaffService rules."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.domestic_staff import schemas
from app.modules.domestic_staff.service import DomesticStaffService


def _svc(db, scope, actor):
    return DomesticStaffService(db, scope, actor)


def _staff(svc, community, phone="+919870000001", **kw):
    payload = schemas.StaffCreate(
        full_name=kw.pop("full_name", "Lakshmi"),
        staff_type=kw.pop("staff_type", "maid"),
        phone=phone,
        **kw,
    )
    return svc.create_staff(payload, community_id=community.id)


def test_duplicate_phone_conflicts(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    _staff(svc, community)
    with pytest.raises(ConflictError) as exc:
        _staff(svc, community)
    assert exc.value.code == "STAFF_EXISTS"


def test_bad_staff_type_rejected(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    with pytest.raises(BusinessRuleError) as exc:
        _staff(svc, community, staff_type="astronaut")
    assert exc.value.code == "INVALID_ENUM"


def test_one_active_assignment_per_unit(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    staff = _staff(svc, community)
    svc.assign_unit(schemas.AssignmentCreate(staff_id=staff.id, unit_id=unit.id))
    with pytest.raises(ConflictError) as exc:
        svc.assign_unit(schemas.AssignmentCreate(staff_id=staff.id, unit_id=unit.id))
    assert exc.value.code == "ASSIGNMENT_EXISTS"


def test_end_assignment_allows_reassign(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    staff = _staff(svc, community)
    a = svc.assign_unit(schemas.AssignmentCreate(staff_id=staff.id, unit_id=unit.id))
    svc.end_assignment(a.id)
    svc.assign_unit(schemas.AssignmentCreate(staff_id=staff.id, unit_id=unit.id))


def test_attendance_cycle(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    staff = _staff(svc, community)
    att = svc.check_in(schemas.CheckInCreate(staff_id=staff.id))
    assert att.attendance_status == "inside"
    with pytest.raises(ConflictError):
        svc.check_in(schemas.CheckInCreate(staff_id=staff.id))
    done = svc.check_out(att.id)
    assert done.attendance_status == "left" and done.check_out_at is not None
    with pytest.raises(BusinessRuleError):
        svc.check_out(att.id)


def test_rating_is_upserted_per_resident(db, scope_for, community, unit, superadmin, make_user):
    resident = make_user()
    svc = _svc(db, scope_for(community.id), resident)
    staff = DomesticStaffService(db, scope_for(community.id), superadmin).create_staff(
        schemas.StaffCreate(full_name="Ravi", staff_type="cook", phone="+919870000009"),
        community_id=community.id,
    )
    r1 = svc.rate_staff(schemas.RatingCreate(staff_id=staff.id, unit_id=unit.id, rating=3))
    r2 = svc.rate_staff(schemas.RatingCreate(staff_id=staff.id, unit_id=unit.id, rating=5))
    assert r1.id == r2.id and r2.rating == 5


def test_verification_status_is_guarded(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    staff = _staff(svc, community)
    assert staff.police_verification_status == "not_started"
    svc.update_staff(staff.id, schemas.StaffUpdate(police_verification_status="pending"))
    svc.update_staff(staff.id, schemas.StaffUpdate(police_verification_status="verified"))
    with pytest.raises(BusinessRuleError) as exc:
        svc.update_staff(staff.id, schemas.StaffUpdate(police_verification_status="not_started"))
    assert exc.value.code == "INVALID_TRANSITION"

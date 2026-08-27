"""Unit tests — VehicleService: owner XOR, slot/vehicle allocation limits, plate entry."""

from __future__ import annotations

import uuid

import pytest

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.vehicles import schemas
from app.modules.vehicles.service import VehicleService


def _svc(db, scope, actor):
    return VehicleService(db, scope, actor)


def _vehicle(svc, community, plate="KA01AB0001"):
    return svc.register_vehicle(
        schemas.VehicleCreate(
            vehicle_type="car",
            registration_number=plate,
            resident_profile_id=uuid.uuid4(),
        ),
        community_id=community.id,
    )


def test_owner_xor_enforced_by_schema():
    with pytest.raises(ValueError, match="exactly one"):
        schemas.VehicleCreate(vehicle_type="car", registration_number="KA01AB0002")


def test_duplicate_plate_conflicts(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    _vehicle(svc, community)
    with pytest.raises(ConflictError) as exc:
        _vehicle(svc, community)
    assert exc.value.code == "VEHICLE_EXISTS"


def test_slot_and_vehicle_single_active_allocation(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = _vehicle(svc, community)
    s1 = svc.create_slot(schemas.SlotCreate(slot_code="A1"), community_id=community.id)
    s2 = svc.create_slot(schemas.SlotCreate(slot_code="A2"), community_id=community.id)
    svc.allocate(schemas.AllocationCreate(slot_id=s1.id, vehicle_id=v.id))
    with pytest.raises(ConflictError) as exc:
        svc.allocate(schemas.AllocationCreate(slot_id=s2.id, vehicle_id=v.id))
    assert exc.value.code == "VEHICLE_HAS_SLOT"
    # releasing frees both
    alloc = svc.list_allocations(community_id=community.id, active_only=True, offset=0, limit=10)[
        0
    ][0]
    svc.release(alloc.id)
    svc.allocate(schemas.AllocationCreate(slot_id=s2.id, vehicle_id=v.id))


def test_unknown_plate_entry_is_flagged(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    e = svc.record_entry(
        schemas.EntryCreate(registration_number="XX00YY0000"), community_id=community.id
    )
    assert e.is_flagged is True and e.vehicle_id is None
    with pytest.raises(ConflictError):
        svc.record_entry(
            schemas.EntryCreate(registration_number="XX00YY0000"), community_id=community.id
        )
    done = svc.record_exit(e.id)
    assert done.status == "exited"


def test_violation_state_machine(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = svc.report_violation(
        schemas.ViolationCreate(violation_type="blocking"), community_id=community.id
    )
    svc.transition_violation(v.id, "acknowledged")
    resolved = svc.transition_violation(v.id, "resolved")
    assert resolved.status == "resolved" and resolved.resolved_at is not None
    with pytest.raises(BusinessRuleError):
        svc.transition_violation(v.id, "open")

"""Unit tests — VehicleService: owner XOR, slot/vehicle allocation limits, plate entry."""

from __future__ import annotations

import uuid

import pytest

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.vehicles import schemas
from app.modules.vehicles.service import VehicleService


def _svc(db, scope, actor):
    return VehicleService(db, scope, actor)


async def _vehicle(svc, community, plate="KA01AB0001"):
    return await svc.register_vehicle(
        schemas.VehicleCreate(
            vehicle_type="car",
            registration_number=plate,
            resident_profile_id=uuid.uuid4(),
        ),
        community_id=community.id,
    )


async def test_owner_xor_enforced_by_schema():
    with pytest.raises(ValueError, match="exactly one"):
        schemas.VehicleCreate(vehicle_type="car", registration_number="KA01AB0002")


async def test_duplicate_plate_conflicts(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    await _vehicle(svc, community)
    with pytest.raises(ConflictError) as exc:
        await _vehicle(svc, community)
    assert exc.value.code == "VEHICLE_EXISTS"


async def test_slot_and_vehicle_single_active_allocation(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = await _vehicle(svc, community)
    s1 = await svc.create_slot(schemas.SlotCreate(slot_code="A1"), community_id=community.id)
    s2 = await svc.create_slot(schemas.SlotCreate(slot_code="A2"), community_id=community.id)
    await svc.allocate(schemas.AllocationCreate(slot_id=s1.id, vehicle_id=v.id))
    with pytest.raises(ConflictError) as exc:
        await svc.allocate(schemas.AllocationCreate(slot_id=s2.id, vehicle_id=v.id))
    assert exc.value.code == "VEHICLE_HAS_SLOT"
    # releasing frees both
    rows, _ = await svc.list_allocations(
        community_id=community.id, active_only=True, offset=0, limit=10
    )
    alloc = rows[0]
    await svc.release(alloc.id)
    await svc.allocate(schemas.AllocationCreate(slot_id=s2.id, vehicle_id=v.id))


async def test_unknown_plate_entry_is_flagged(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    e = await svc.record_entry(
        schemas.EntryCreate(registration_number="XX00YY0000"), community_id=community.id
    )
    assert e.is_flagged is True and e.vehicle_id is None
    with pytest.raises(ConflictError):
        await svc.record_entry(
            schemas.EntryCreate(registration_number="XX00YY0000"), community_id=community.id
        )
    done = await svc.record_exit(e.id)
    assert done.status == "exited"


async def test_violation_state_machine(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = await svc.report_violation(
        schemas.ViolationCreate(violation_type="blocking"), community_id=community.id
    )
    await svc.transition_violation(v.id, "acknowledged")
    resolved = await svc.transition_violation(v.id, "resolved")
    assert resolved.status == "resolved" and resolved.resolved_at is not None
    with pytest.raises(BusinessRuleError):
        await svc.transition_violation(v.id, "open")

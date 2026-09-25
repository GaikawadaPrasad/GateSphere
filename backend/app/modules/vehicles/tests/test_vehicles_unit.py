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
    with pytest.raises(ValueError, match="cannot specify both"):
        schemas.VehicleCreate(
            vehicle_type="car",
            registration_number="KA01AB0002",
            resident_profile_id=uuid.uuid4(),
            visitor_id=uuid.uuid4(),
        )


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


# -- plate normalization, blacklist interception, violation plate, allocation guards -- #
def test_plate_is_normalized_at_the_edge():
    assert schemas.EntryCreate(registration_number="ka 01-ab 1234").registration_number == (
        "KA01AB1234"
    )
    with pytest.raises(ValueError):
        schemas.EntryCreate(registration_number="KA#01")
    assert schemas.plate_search_term("ka-01 %_") == "KA01"


async def test_registered_plate_with_separators_is_not_flagged(
    db, scope_for, community, superadmin
):
    svc = _svc(db, scope_for(community.id), superadmin)
    await _vehicle(svc, community, plate="KA01AB7777")
    e = await svc.record_entry(
        schemas.EntryCreate(registration_number="ka 01 ab-7777"), community_id=community.id
    )
    assert e.is_flagged is False and e.registration_number == "KA01AB7777"


async def test_deactivated_vehicle_entry_is_flagged(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = await _vehicle(svc, community, plate="KA01AB6666")
    await svc.update_vehicle(v.id, schemas.VehicleUpdate(is_active=False))
    e = await svc.record_entry(
        schemas.EntryCreate(registration_number="KA01AB6666"), community_id=community.id
    )
    assert e.is_flagged is True and e.vehicle_id is None


async def _blacklist_plate(db, community, plate: str):
    from app.modules.visitors.models import Visitor, VisitorBlacklist

    visitor = Visitor(
        community_id=community.id,
        full_name="Banned Driver",
        phone=f"9{uuid.uuid4().int % 10**9:09d}",
        vehicle_number=plate,
    )
    db.add(visitor)
    await db.flush()
    db.add(
        VisitorBlacklist(
            community_id=community.id,
            visitor_id=visitor.id,
            phone_hash=uuid.uuid4().hex,
            reason="Tailgating incident",
            risk_level="high",
        )
    )
    await db.flush()


async def test_blacklisted_plate_is_intercepted_before_entry(db, scope_for, community, superadmin):
    from app.core.errors import ForbiddenError

    svc = _svc(db, scope_for(community.id), superadmin)
    await _blacklist_plate(db, community, "KA 05 BL 0001")  # stored with spaces
    with pytest.raises(ForbiddenError) as exc:
        await svc.record_entry(
            schemas.EntryCreate(registration_number="KA05BL0001"), community_id=community.id
        )
    assert exc.value.code == "PLATE_BLACKLISTED"
    rows, total = await svc.list_entries(
        community_id=community.id, plate="KA05BL0001", open_only=False, offset=0, limit=5
    )
    assert total == 0 and rows == []  # nothing recorded


async def test_blacklist_warn_mode_records_a_flagged_entry(db, scope_for, community, superadmin):
    from app.modules.visitors.models import VisitorPolicy

    db.add(VisitorPolicy(community_id=community.id, blacklist_mode="warn"))
    await db.flush()
    svc = _svc(db, scope_for(community.id), superadmin)
    await _vehicle(svc, community, plate="KA05BL0002")  # registered, yet blacklisted
    await _blacklist_plate(db, community, "KA05BL0002")
    e = await svc.record_entry(
        schemas.EntryCreate(registration_number="KA05BL0002"), community_id=community.id
    )
    assert e.is_flagged is True


async def test_violation_plate_auto_matches_registered_vehicle(
    db, scope_for, community, superadmin
):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = await _vehicle(svc, community, plate="KA01AB5555")
    known = await svc.report_violation(
        schemas.ViolationCreate(violation_type="wrong_slot", registration_number="ka01ab5555"),
        community_id=community.id,
    )
    assert known.vehicle_id == v.id and known.registration_number == "KA01AB5555"
    unknown = await svc.report_violation(
        schemas.ViolationCreate(violation_type="unauthorized", registration_number="MH99ZZ0001"),
        community_id=community.id,
    )
    assert unknown.vehicle_id is None and unknown.registration_number == "MH99ZZ0001"
    rows, _ = await svc.list_violations(
        community_id=community.id, violation_status=None, plate="MH99", offset=0, limit=5
    )
    assert [r.id for r in rows] == [unknown.id]


async def test_violation_rejects_foreign_vehicle_and_slot(db, scope_for, community, superadmin):
    from app.core.errors import NotFoundError
    from app.modules.communities.models import Community

    other = Community(code=f"vh-{uuid.uuid4().hex[:8]}", name="Other Vehicles Community")
    db.add(other)
    await db.flush()
    foreign_svc = _svc(db, scope_for(other.id), superadmin)
    foreign_vehicle = await _vehicle(foreign_svc, other, plate="KA02FF0001")
    foreign_slot = await foreign_svc.create_slot(
        schemas.SlotCreate(slot_code="F1"), community_id=other.id
    )

    svc = _svc(db, scope_for(community.id), superadmin)
    with pytest.raises(NotFoundError):
        await svc.report_violation(
            schemas.ViolationCreate(violation_type="blocking", vehicle_id=foreign_vehicle.id),
            community_id=community.id,
        )
    with pytest.raises(NotFoundError):
        await svc.report_violation(
            schemas.ViolationCreate(violation_type="blocking", parking_slot_id=foreign_slot.id),
            community_id=community.id,
        )


async def test_allocation_guards(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    v = await _vehicle(svc, community, plate="KA01AB4444")
    blocked = await svc.create_slot(schemas.SlotCreate(slot_code="B1"), community_id=community.id)
    blocked.status = "blocked"
    reserved = await svc.create_slot(
        schemas.SlotCreate(slot_code="R1", reserved_for_unit_id=uuid.uuid4()),
        community_id=community.id,
    )
    with pytest.raises(BusinessRuleError) as exc:
        await svc.allocate(schemas.AllocationCreate(slot_id=blocked.id, vehicle_id=v.id))
    assert exc.value.code == "SLOT_BLOCKED"
    with pytest.raises(BusinessRuleError) as exc:
        await svc.allocate(schemas.AllocationCreate(slot_id=reserved.id, vehicle_id=v.id))
    assert exc.value.code == "SLOT_RESERVED"
    free = await svc.create_slot(schemas.SlotCreate(slot_code="F9"), community_id=community.id)
    await svc.update_vehicle(v.id, schemas.VehicleUpdate(is_active=False))
    with pytest.raises(BusinessRuleError) as exc:
        await svc.allocate(schemas.AllocationCreate(slot_id=free.id, vehicle_id=v.id))
    assert exc.value.code == "VEHICLE_INACTIVE"

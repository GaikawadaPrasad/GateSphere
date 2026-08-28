"""Unit tests — CommunityService business rules in isolation (no HTTP). Async (ADR-010)."""

from __future__ import annotations

import uuid

import pytest

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.modules.communities import schemas
from app.modules.communities.service import CommunityService


def _svc(db, scope, actor):
    return CommunityService(db, scope, actor)


async def test_create_community_requires_global_scope(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    with pytest.raises(ForbiddenError) as exc:
        await svc.create_community(schemas.CommunityCreate(code="x1", name="Nope"))
    assert exc.value.code == "GLOBAL_ONLY"


async def test_create_community_duplicate_code_conflicts(db, global_scope, community, superadmin):
    svc = _svc(db, global_scope, superadmin)
    with pytest.raises(ConflictError) as exc:
        await svc.create_community(schemas.CommunityCreate(code=community.code, name="Dup"))
    assert exc.value.code == "COMMUNITY_CODE_TAKEN"


async def test_tower_bad_structure_type_is_business_rule_error(
    db, scope_for, community, superadmin
):
    svc = _svc(db, scope_for(community.id), superadmin)
    payload = schemas.TowerCreate(code="TA", name="Tower A", structure_type="skyscraper")
    with pytest.raises(BusinessRuleError) as exc:
        await svc.create_tower(community_id=community.id, payload=payload)
    assert exc.value.code == "INVALID_ENUM"


async def test_floor_in_tower_outside_scope_is_404(db, scope_for, community, superadmin):
    svc_owner = _svc(db, scope_for(community.id), superadmin)
    tower = await svc_owner.create_tower(
        community_id=community.id, payload=schemas.TowerCreate(code="TB", name="Tower B")
    )
    svc_other = _svc(db, scope_for(uuid.uuid4()), superadmin)
    with pytest.raises(NotFoundError):
        await svc_other.create_floor(schemas.FloorCreate(tower_id=tower.id, floor_number=1))


async def test_unit_inherits_community_and_tower_from_floor(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    tower = await svc.create_tower(
        community_id=community.id, payload=schemas.TowerCreate(code="TC", name="Tower C")
    )
    floor = await svc.create_floor(schemas.FloorCreate(tower_id=tower.id, floor_number=3))
    unit = await svc.create_unit(schemas.UnitCreate(floor_id=floor.id, unit_number="C-301"))
    assert unit.community_id == community.id
    assert unit.tower_id == tower.id
    assert unit.floor_id == floor.id


async def test_duplicate_unit_number_on_floor_conflicts(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    tower = await svc.create_tower(
        community_id=community.id, payload=schemas.TowerCreate(code="TD", name="Tower D")
    )
    floor = await svc.create_floor(schemas.FloorCreate(tower_id=tower.id, floor_number=1))
    await svc.create_unit(schemas.UnitCreate(floor_id=floor.id, unit_number="D-101"))
    with pytest.raises(ConflictError) as exc:
        await svc.create_unit(schemas.UnitCreate(floor_id=floor.id, unit_number="D-101"))
    assert exc.value.code == "UNIT_NUMBER_TAKEN"


async def test_create_writes_an_audit_row(db, scope_for, community, superadmin):
    from sqlalchemy import func, select

    from app.modules.audit.models import AuditLog

    before = await db.scalar(select(func.count()).select_from(AuditLog))
    svc = _svc(db, scope_for(community.id), superadmin)
    await svc.create_tower(
        community_id=community.id, payload=schemas.TowerCreate(code="TE", name="Tower E")
    )
    after = await db.scalar(select(func.count()).select_from(AuditLog))
    assert after == before + 1

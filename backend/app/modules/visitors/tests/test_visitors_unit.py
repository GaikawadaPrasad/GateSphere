"""Unit tests — VisitorService lifecycle rules."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError
from app.modules.visitors import schemas
from app.modules.visitors.service import VisitorService


def _svc(db, scope, actor):
    return VisitorService(db, scope, actor)


async def _req(svc, unit, **kw):
    payload = schemas.RequestCreate(
        unit_id=unit.id,
        visitor=schemas.VisitorCreate(full_name="Guest", phone=kw.pop("phone", "+919812345678")),
        visitor_type=kw.pop("visitor_type", "personal_guest"),
        **kw,
    )
    return await svc.create_request(payload)


async def test_recurring_visitor_needs_no_approval(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit, visitor_type="recurring")
    assert req.approval_required is False and req.status == "approved"


async def test_guest_request_is_pending_then_approved(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit)
    assert req.status == "pending"
    decided = await svc.decide_request(req.id, schemas.RequestDecision(decision="approved"))
    assert decided.status == "approved"


async def test_double_decision_conflicts(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit)
    await svc.decide_request(req.id, schemas.RequestDecision(decision="approved"))
    with pytest.raises(BusinessRuleError):  # request no longer pending
        await svc.decide_request(req.id, schemas.RequestDecision(decision="rejected"))


async def test_blacklisted_visitor_blocked_at_request(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    await svc.add_blacklist(
        schemas.BlacklistCreate(phone="+919800000001", reason="theft"), community_id=community.id
    )
    with pytest.raises(ForbiddenError) as exc:
        await _req(svc, unit, phone="+919800000001")
    assert exc.value.code == "VISITOR_BLACKLISTED"


async def test_entry_requires_approved_request(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit)  # pending
    with pytest.raises(BusinessRuleError) as exc:
        await svc.record_entry(schemas.EntryCreate(request_id=req.id))
    assert exc.value.code == "NOT_APPROVED"


async def test_full_entry_exit_cycle(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit, visitor_type="recurring")  # auto-approved
    entry = await svc.record_entry(schemas.EntryCreate(request_id=req.id))
    assert entry.status == "inside" and entry.entry_at is not None
    await db.refresh(req)
    assert req.status == "entered"
    # second entry while inside -> conflict
    with pytest.raises(ConflictError):
        await svc.record_entry(schemas.EntryCreate(request_id=req.id))
    done = await svc.record_exit(entry.id)
    assert done.status == "exited" and done.exit_at is not None
    await db.refresh(req)
    assert req.status == "completed"


async def test_pass_issue_and_use(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit)  # pending
    vpass, token, _pin = await svc.create_pass(req.id, schemas.PassCreate(max_entries=1))
    await db.refresh(req)
    assert req.status == "approved"  # a pass pre-approves
    entry = await svc.record_entry(schemas.EntryCreate(pass_token=token))
    assert entry.status == "inside"
    await db.refresh(vpass)
    assert vpass.entry_count == 1
    await svc.record_exit(entry.id)
    with pytest.raises(BusinessRuleError) as exc:
        await svc.record_entry(schemas.EntryCreate(pass_token=token))
    assert exc.value.code == "PASS_EXHAUSTED"


async def test_revoked_pass_rejected(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    req = await _req(svc, unit)
    vpass, token, _pin = await svc.create_pass(req.id, schemas.PassCreate())
    await svc.revoke_pass(vpass.id)
    with pytest.raises(BusinessRuleError) as exc:
        await svc.record_entry(schemas.EntryCreate(pass_token=token))
    assert exc.value.code == "PASS_REVOKED"

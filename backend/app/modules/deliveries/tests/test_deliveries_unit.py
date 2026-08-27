"""Unit tests — DeliveryService lifecycle + protocol-driven auto-approval."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError
from app.modules.deliveries import schemas
from app.modules.deliveries.service import DeliveryService


def _svc(db, scope, actor):
    return DeliveryService(db, scope, actor)


def _protocol(svc, community, dtype="ecommerce", **kw):
    payload = schemas.ProtocolUpsert(delivery_type=dtype, **kw)
    return svc.upsert_protocol(payload, community_id=community.id)


def test_protocol_upsert_is_idempotent(db, scope_for, community, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    a = _protocol(svc, community, requires_otp=True)
    b = _protocol(svc, community, requires_otp=False)
    assert a.id == b.id and b.requires_otp is False


def test_direct_entry_protocol_auto_approves(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    _protocol(svc, community, "food", allow_direct_entry=True, requires_otp=False)
    d = svc.create_delivery(schemas.DeliveryCreate(unit_id=unit.id, delivery_type="food"))
    assert d.approval_status == "auto_approved"


def test_default_protocol_requires_approval(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    d = svc.create_delivery(schemas.DeliveryCreate(unit_id=unit.id, delivery_type="courier"))
    assert d.approval_status == "pending"
    with pytest.raises(BusinessRuleError) as exc:
        svc.record_arrival(d.id, schemas.DeliveryArrival())
    assert exc.value.code == "NOT_APPROVED"


def test_full_lifecycle(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    d = svc.create_delivery(schemas.DeliveryCreate(unit_id=unit.id, delivery_type="grocery"))
    svc.decide_delivery(d.id, schemas.DeliveryDecision(decision="approved"))
    arrived = svc.record_arrival(d.id, schemas.DeliveryArrival())
    assert arrived.status == "at_gate" and arrived.arrived_at is not None
    done = svc.mark_delivered(d.id)
    assert done.status in ("delivered", "collected")
    events = svc.list_events(d.id)
    assert [e.event_type for e in events] == ["logged", "approved", "arrived", "delivered"]


def test_rejected_delivery_is_cancelled(db, scope_for, community, unit, superadmin):
    svc = _svc(db, scope_for(community.id), superadmin)
    d = svc.create_delivery(schemas.DeliveryCreate(unit_id=unit.id, delivery_type="courier"))
    out = svc.decide_delivery(d.id, schemas.DeliveryDecision(decision="rejected"))
    assert out.approval_status == "rejected" and out.status == "cancelled"
    with pytest.raises(BusinessRuleError):
        svc.decide_delivery(d.id, schemas.DeliveryDecision(decision="approved"))

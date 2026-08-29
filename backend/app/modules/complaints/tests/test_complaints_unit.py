"""Unit tests — ComplaintService: SLA clocks, lifecycle, confirmation gate, feedback."""

from __future__ import annotations

import pytest

from app.core.errors import BusinessRuleError, ConflictError
from app.modules.complaints import schemas
from app.modules.complaints.service import ComplaintService


def _svc(db, scope, actor):
    return ComplaintService(db, scope, actor)


async def _ticket(svc, unit, category, **kw):
    return await svc.create_ticket(
        schemas.TicketCreate(
            unit_id=unit.id, category_id=category.id, subject=kw.pop("subject", "Leak"), **kw
        )
    )


async def test_ticket_inherits_category_priority_and_sla(
    db, scope_for, community, unit, category, superadmin
):
    svc = _svc(db, scope_for(community.id), superadmin)
    t = await _ticket(svc, unit, category)
    assert t.priority == "high"
    assert t.first_response_due_at is not None and t.resolution_due_at is not None
    assert t.status == "created" and t.ticket_number.startswith("TKT-")


async def test_full_lifecycle_to_closed_needs_confirmation(
    db, scope_for, community, unit, category, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    t = await _ticket(svc, unit, category)
    await svc.assign_ticket(t.id, schemas.TicketAssign(assigned_to_user_id=(await make_user()).id))
    assert t.status == "assigned"
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="acknowledged"))
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="in_progress"))
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="resolved"))
    assert t.status == "resident_confirmation" and t.resolved_at is not None

    # cannot jump straight to closed via transition
    with pytest.raises(BusinessRuleError):
        await svc.transition_ticket(t.id, schemas.TicketTransition(status="closed"))

    await svc.confirm_ticket(t.id, schemas.TicketConfirm(confirmation_status="confirmed"))
    assert t.status == "closed" and t.closed_at is not None

    hist = [h.to_status for h in await svc.list_history(t.id)]
    assert hist == [
        "created",
        "assigned",
        "acknowledged",
        "in_progress",
        "resolved",
        "resident_confirmation",
        "closed",
    ]


async def test_disputed_confirmation_reopens(
    db, scope_for, community, unit, category, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    t = await _ticket(svc, unit, category)
    await svc.assign_ticket(t.id, schemas.TicketAssign(vendor_name="Acme Plumbers"))
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="in_progress"))
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="resolved"))
    await svc.confirm_ticket(t.id, schemas.TicketConfirm(confirmation_status="disputed"))
    assert t.status == "reopened" and t.resident_confirmation_status == "disputed"


async def test_assignment_executor_xor():
    with pytest.raises(ValueError, match="exactly one"):
        schemas.TicketAssign(assigned_to_user_id=None, vendor_name=None)
    with pytest.raises(ValueError, match="exactly one"):
        schemas.TicketAssign(
            assigned_to_user_id="00000000-0000-0000-0000-000000000001", vendor_name="X"
        )


async def test_feedback_only_after_close_and_once(
    db, scope_for, community, unit, category, superadmin, make_user
):
    svc = _svc(db, scope_for(community.id), superadmin)
    t = await _ticket(svc, unit, category)
    with pytest.raises(BusinessRuleError) as exc:
        await svc.add_feedback(t.id, schemas.FeedbackCreate(rating=5))
    assert exc.value.code == "TICKET_NOT_CLOSED"

    await svc.assign_ticket(t.id, schemas.TicketAssign(vendor_name="Acme"))
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="in_progress"))
    await svc.transition_ticket(t.id, schemas.TicketTransition(status="resolved"))
    await svc.confirm_ticket(t.id, schemas.TicketConfirm(confirmation_status="confirmed"))
    await svc.add_feedback(t.id, schemas.FeedbackCreate(rating=4, comments="ok"))
    with pytest.raises(ConflictError):
        await svc.add_feedback(t.id, schemas.FeedbackCreate(rating=3))

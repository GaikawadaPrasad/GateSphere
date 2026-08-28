"""FR-10 — SLA escalation sweep (`app.modules.complaints.tasks.sweep_ticket_sla`)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.complaints.models import ServiceTicket
from app.modules.complaints.tasks import sweep_ticket_sla
from app.modules.notifications.models import Notification


def _raise_ticket(as_role, seed_ids) -> str:
    from app.modules.communities.models import Unit
    from app.modules.complaints.models import ServiceCategory

    cid = seed_ids["community_id"]
    with SessionLocal() as db:
        unit = db.scalar(select(Unit).where(Unit.community_id == cid).order_by(Unit.unit_number))
        cat = db.scalar(
            select(ServiceCategory)
            .where(ServiceCategory.community_id == cid)
            .order_by(ServiceCategory.code)
        )
    r = as_role("resident").post(
        "/api/v1/complaints/tickets",
        json={"unit_id": str(unit.id), "category_id": str(cat.id), "subject": "SLA probe"},
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]["id"]


def _backdate(ticket_id: str, **cols) -> None:
    with SessionLocal() as db:
        t = db.get(ServiceTicket, ticket_id)
        for k, v in cols.items():
            setattr(t, k, v)
        db.commit()


def test_sweep_marks_breach_then_escalation_and_notifies(as_role, seed_ids):
    tid = _raise_ticket(as_role, seed_ids)
    now = datetime.now(UTC)
    # resolution window already elapsed, escalation not yet due -> breached
    _backdate(
        tid,
        created_at=now - timedelta(hours=30),
        resolution_due_at=now - timedelta(hours=1),
        escalation_due_at=now + timedelta(hours=1),
        escalation_state="on_track",
        sla_breached_at=None,
    )
    out = sweep_ticket_sla()
    assert out["tickets_changed"] >= 1
    with SessionLocal() as db:
        t = db.get(ServiceTicket, tid)
        assert t.escalation_state == "breached"
        assert t.sla_breached_at is not None
        notes = db.scalars(
            select(Notification).where(
                Notification.reference_id == t.id,
                Notification.notification_type == "complaints.ticket_breached",
            )
        ).all()
        assert notes, "resident/role should have been notified of the breach"

    # a second sweep with escalation now due advances to escalated + bumps level
    _backdate(tid, escalation_due_at=now - timedelta(minutes=5))
    sweep_ticket_sla()
    with SessionLocal() as db:
        t = db.get(ServiceTicket, tid)
        assert t.escalation_state == "escalated"
        assert t.escalation_level == 1
        assert t.escalated_at is not None

    # idempotent — nothing left to advance
    before = sweep_ticket_sla()["tickets_changed"]
    after = sweep_ticket_sla()["tickets_changed"]
    assert after <= before

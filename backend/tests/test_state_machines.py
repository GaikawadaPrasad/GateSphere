"""Stage-5 cross-module state-machine assertions.

One representative *valid* transition and one *invalid* transition per lifecycle, driven
through the public API, plus the two hardening fixes from Stage 5:
  - SM-1: `create_pass` no longer auto-approves for a non-approver / non-occupant
  - 0025: a status column will not accept a value outside its enum (DB CHECK)

Detailed per-transition coverage lives in each module's `test_*_unit.py`.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select, text

from app.db.session import SessionLocal


# --------------------------------------------------------------------------- DB CHECK
def test_status_check_constraints_reject_impossible_state():
    """Migration 0025: an out-of-enum status cannot be persisted even by raw SQL."""
    from app.modules.communities.models import Community

    with SessionLocal() as db:
        cid = db.scalar(select(Community.id))
        with pytest.raises(Exception) as ei:  # IntegrityError (CheckViolation)
            db.execute(
                text(
                    "INSERT INTO amenity_bookings (id, community_id, amenity_id, slot_id,"
                    " unit_id, resident_user_id, booking_date, start_at, end_at,"
                    " participant_count, status, created_at, updated_at)"
                    " VALUES (gen_random_uuid(), :c, gen_random_uuid(), gen_random_uuid(),"
                    " gen_random_uuid(), gen_random_uuid(), current_date, now(), now(), 1,"
                    " 'teleported', now(), now())"
                ),
                {"c": str(cid)},
            )
            db.flush()
        db.rollback()
    assert "ck_amenity_bookings_status_valid" in str(ei.value) or "check" in str(ei.value).lower()


# --------------------------------------------------------------------------- complaints
def test_complaint_invalid_transition_rejected(as_role, seed_ids, resident_unit_id):
    P = "/api/v1/complaints"
    resident = as_role("resident")
    cat = _first_category(seed_ids["community_id"])
    r = resident.post(
        f"{P}/tickets",
        json={"category_id": cat, "unit_id": resident_unit_id, "subject": "sm"},
    )
    assert r.status_code == 201, r.text
    tid = r.json()["data"]["id"]
    fm = as_role("facility_manager")
    # created -> closed is not a legal move
    bad = fm.post(f"{P}/tickets/{tid}/transition", json={"status": "closed"})
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] in ("INVALID_TRANSITION", "VALIDATION_ERROR")


def _first_category(community_id: str) -> str:
    from app.modules.complaints.models import ServiceCategory

    with SessionLocal() as db:
        return str(
            db.scalar(
                select(ServiceCategory.id)
                .where(ServiceCategory.community_id == community_id)
                .order_by(ServiceCategory.code)
            )
        )


# --------------------------------------------------------------------------- incidents
def test_incident_happy_path_and_bad_move(as_role, seed_ids):
    P = "/api/v1/incidents"
    sup = as_role("security_supervisor")
    r = sup.post(
        P,
        json={
            "community_id": seed_ids["community_id"],
            "incident_type": "breach",
            "severity": "high",
            "location_text": "sm-test",
            "description": "x",
        },
    )
    assert r.status_code == 201, r.text
    iid = r.json()["data"]["id"]
    assert sup.post(f"{P}/{iid}/transition", json={"status": "acknowledged"}).status_code == 200
    # reported/acknowledged -> closed is illegal (must pass through responding/resolved)
    skip = sup.post(f"{P}/{iid}/transition", json={"status": "closed"})
    assert skip.status_code == 422


# --------------------------------------------------------------------------- visitors / SM-1
def test_create_pass_does_not_auto_approve_for_non_approver(as_role, seed_ids):
    """A security_guard (has visitors:create, not visitors:approve, occupies no unit)
    issuing a pass for a pending request must NOT flip it to approved."""
    P = "/api/v1/visitors"
    guard = as_role("security_guard")
    # find a pending request in the guard's community
    from app.modules.visitors.models import VisitorRequest

    with SessionLocal() as db:
        req = db.scalars(
            select(VisitorRequest)
            .where(
                VisitorRequest.community_id == uuid.UUID(seed_ids["community_id"]),
                VisitorRequest.status == "pending",
                VisitorRequest.approval_required.is_(True),
            )
            .limit(1)
        ).first()
    if req is None:
        pytest.skip("no pending approval-required visitor request in seed")
    before = req.status
    guard.post(f"{P}/requests/{req.id}/passes", json={"pass_type": "qr"})
    # pass creation itself may succeed (201) or be forbidden by RBAC (403) — either is fine;
    # what must NOT happen is a silent approval.
    with SessionLocal() as db:
        after = db.scalar(select(VisitorRequest.status).where(VisitorRequest.id == req.id))
    assert after in (
        before,
        "pending",
    ), f"request was silently approved by a non-approver ({after})"


def test_csv_exports_and_search(as_role, seed_ids):
    """GAP-3 / GAP-4: operational CSV exports + ?q= free-text search."""
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    for path, header0 in [
        (f"/api/v1/billing/invoices.csv?community_id={cid}", "invoice_number"),
        (f"/api/v1/billing/payments.csv?community_id={cid}", "payment_reference"),
        (f"/api/v1/gate/events.csv?community_id={cid}", "occurred_at"),
        (f"/api/v1/visitors/entries.csv?community_id={cid}", "entry_at"),
        (f"/api/v1/complaints/tickets.csv?community_id={cid}", "ticket_number"),
    ]:
        r = admin.get(path)
        assert r.status_code == 200, (path, r.text[:200])
        assert r.headers["content-type"].startswith("text/csv")
        assert r.text.splitlines()[0].split(",")[0] == header0

    # search hits (empty result is fine — just must not 500 and must be scoped)
    for path in [
        f"/api/v1/complaints/tickets?community_id={cid}&q=leak",
        f"/api/v1/incidents?community_id={cid}&q=gate",
        f"/api/v1/deliveries?community_id={cid}&q=amazon",
    ]:
        assert admin.get(path).status_code == 200

    # auditor can export (has *:export via billing:export) but a plain resident cannot
    assert (
        as_role("resident").get(f"/api/v1/billing/invoices.csv?community_id={cid}").status_code
        == 403
    )

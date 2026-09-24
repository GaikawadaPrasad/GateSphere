"""Integration tests — Deliveries router, RBAC, tenant scope."""

from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/deliveries"


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        if u is None:
            from app.modules.communities.models import Floor, Tower

            tower = db.scalar(select(Tower).where(Tower.community_id == community_id))
            if not tower:
                tower = Tower(community_id=community_id, name="Tower T", code="TT")
                db.add(tower)
                db.flush()
            floor = db.scalar(select(Floor).where(Floor.tower_id == tower.id))
            if not floor:
                floor = Floor(community_id=community_id, tower_id=tower.id, floor_number=1)
                db.add(floor)
                db.flush()
            u = Unit(
                community_id=community_id,
                tower_id=tower.id,
                floor_id=floor.id,
                unit_number="U-999",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "deliveries"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_guard_logs_resident_approves_guard_completes(as_role, seed_ids, resident_unit_id):
    guard = as_role("security_guard")
    unit_id = resident_unit_id  # the resident may only approve deliveries for a unit they occupy
    r = guard.post(
        P, json={"unit_id": unit_id, "delivery_type": "courier", "provider_name": "BlueDart"}
    )
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["approval_status"] == "pending"

    resident = as_role("resident")
    ok = resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"})
    assert ok.status_code == 200, ok.text

    arr = guard.post(f"{P}/{d['id']}/arrival", json={})
    assert arr.status_code == 200, arr.text
    assert guard.post(f"{P}/{d['id']}/delivered").status_code == 200


def test_protocol_upsert_requires_approve_perm(as_role, seed_ids):
    guard = as_role("security_guard")
    r = guard.put(
        f"{P}/protocols", json={"delivery_type": "food", "protocol_type": "collect_at_gate"}
    )
    assert r.status_code == 403

    admin = as_role("community_admin")
    r = admin.put(
        f"{P}/protocols",
        json={"delivery_type": "food", "allow_direct_entry": True},
    )
    assert r.status_code == 200, r.text


def test_cross_community_unit_is_404(as_role, seed_ids):
    guard = as_role("security_guard")
    other = _unit_in(seed_ids["other_community_id"])
    r = guard.post(P, json={"unit_id": other, "delivery_type": "food"})
    assert r.status_code == 404


def test_resident_cannot_touch_other_units_delivery(as_role, seed_ids, resident_unit_id):
    guard = as_role("security_guard")
    other_unit = _unit_in(seed_ids["community_id"])
    assert other_unit != resident_unit_id
    d = guard.post(
        P,
        json={"unit_id": other_unit, "delivery_type": "courier", "provider_name": "X"},
    ).json()["data"]

    resident = as_role("resident")
    assert resident.get(f"{P}/{d['id']}").status_code == 404
    assert (
        resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"}).status_code == 404
    )
    assert all(x["id"] != d["id"] for x in resident.get(P).json()["data"])
    assert as_role("community_admin").get(f"{P}/{d['id']}").status_code == 200


def test_duplicate_handover_is_rejected_without_double_effect(as_role, seed_ids, resident_unit_id):
    """Retried handover/completion must fail safe (422), never record twice."""
    from app.modules.deliveries.models import Delivery, DeliveryEvent

    guard = as_role("security_guard")
    d = guard.post(
        P,
        json={
            "unit_id": resident_unit_id,
            "delivery_type": "courier",
            "provider_name": "RacePost",
        },
    ).json()["data"]
    try:
        resident = as_role("resident")
        assert resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"})
        assert guard.post(f"{P}/{d['id']}/arrival", json={}).status_code == 200
        first = guard.post(f"{P}/{d['id']}/delivered")
        assert first.status_code == 200, first.text
        # `delivered` or `collected` depending on the unit's protocol (F5); either way the
        # retry must not change it.
        final_status = first.json()["data"]["status"]
        assert final_status in ("delivered", "collected")

        dup = guard.post(f"{P}/{d['id']}/delivered")
        assert dup.status_code == 422, dup.text
        assert dup.json()["error"]["code"] == "INVALID_TRANSITION"
        assert guard.get(f"{P}/{d['id']}").json()["data"]["status"] == final_status
        with SessionLocal() as db:
            completions = (
                db.query(DeliveryEvent)
                .filter_by(delivery_id=d["id"], event_type="delivered")
                .count()
            )
            assert completions == 1
    finally:
        with SessionLocal() as db:
            for row in db.query(DeliveryEvent).filter_by(delivery_id=d["id"]).all():
                db.delete(row)
            obj = db.get(Delivery, d["id"])
            if obj is not None:
                db.delete(obj)
            db.commit()


def test_guard_sends_approval_request_to_resident(as_role, resident_unit_id):
    guard = as_role("security_guard")
    unit_id = resident_unit_id

    # Guard logs delivery
    r = guard.post(
        P,
        json={
            "unit_id": unit_id,
            "delivery_type": "courier",
            "provider_name": "Amazon Express",
            "tracking_reference": "AMZ-987654",
        },
    )
    assert r.status_code == 201, r.text
    del_data = r.json()["data"]
    delivery_id = del_data["id"]
    assert del_data["approval_status"] == "pending"

    # Guard sends approval request notification to resident
    r_notify = guard.post(
        f"{P}/{delivery_id}/notify",
        json={"notes": "Please confirm if courier can be allowed inside tower."},
    )
    assert r_notify.status_code == 200, r_notify.text
    assert r_notify.json()["message"] == "Approval request sent to resident"

    # Verify event logged
    events_res = guard.get(f"{P}/{delivery_id}/events")
    assert events_res.status_code == 200
    events = events_res.json()["data"]
    notified_events = [e for e in events if e["event_type"] == "notified"]
    assert len(notified_events) >= 1
    assert "Please confirm" in (notified_events[0]["remarks"] or "")


def test_protocol_allow_at_gate_workflow(as_role, resident_unit_id):
    """Protocol allow_at_gate: auto-approved, arrives, marks delivered."""
    admin = as_role("community_admin")
    guard = as_role("security_guard")

    # Set protocol for food to allow_at_gate
    r = admin.put(
        f"{P}/protocols",
        json={"delivery_type": "food", "protocol_type": "allow_at_gate"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["protocol_type"] == "allow_at_gate"

    # Guard creates food delivery
    res = guard.post(
        P,
        json={
            "unit_id": resident_unit_id,
            "delivery_type": "food",
            "provider_name": "Swiggy",
        },
    )
    assert res.status_code == 201, res.text
    d = res.json()["data"]
    assert d["approval_status"] == "auto_approved"
    assert d["status"] == "expected"

    # Executive arrives at gate
    arr = guard.post(f"{P}/{d['id']}/arrival", json={})
    assert arr.status_code == 200
    assert arr.json()["data"]["status"] == "at_gate"

    # Guard completes delivery
    done = guard.post(f"{P}/{d['id']}/delivered")
    assert done.status_code == 200
    assert done.json()["data"]["status"] == "delivered"


def test_protocol_resident_approval_required_workflow(as_role, resident_unit_id):
    """Protocol resident_approval_required: pending until resident approves, then arrives and delivers."""
    admin = as_role("community_admin")
    guard = as_role("security_guard")
    resident = as_role("resident")

    r = admin.put(
        f"{P}/protocols",
        json={"delivery_type": "medicine", "protocol_type": "resident_approval_required"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["protocol_type"] == "resident_approval_required"

    # Guard creates delivery
    res = guard.post(
        P,
        json={
            "unit_id": resident_unit_id,
            "delivery_type": "medicine",
            "provider_name": "Apollo Pharmacy",
        },
    )
    assert res.status_code == 201, res.text
    d = res.json()["data"]
    assert d["approval_status"] == "pending"

    # Resident approves
    dec = resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"})
    assert dec.status_code == 200
    assert dec.json()["data"]["approval_status"] == "approved"

    # Arrival and delivery
    arr = guard.post(f"{P}/{d['id']}/arrival", json={})
    assert arr.status_code == 200
    assert arr.json()["data"]["status"] == "at_gate"


def test_protocol_leave_at_gate_desk_and_collect_endpoint(as_role, resident_unit_id):
    """Protocol leave_at_gate_desk: auto-approved, arrives at gate, and collected via POST /collect."""
    admin = as_role("community_admin")
    guard = as_role("security_guard")
    resident = as_role("resident")

    r = admin.put(
        f"{P}/protocols",
        json={"delivery_type": "ecommerce", "protocol_type": "leave_at_gate_desk"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["protocol_type"] == "leave_at_gate_desk"

    # Create delivery
    res = guard.post(
        P,
        json={
            "unit_id": resident_unit_id,
            "delivery_type": "ecommerce",
            "provider_name": "Flipkart",
            "tracking_reference": "FK-12345",
        },
    )
    assert res.status_code == 201, res.text
    d = res.json()["data"]
    assert d["approval_status"] == "auto_approved"

    # Arrive at gate desk
    arr = guard.post(f"{P}/{d['id']}/arrival", json={})
    assert arr.status_code == 200
    assert arr.json()["data"]["status"] == "at_gate"

    # Resident or guard collects package from gate desk
    col = resident.post(f"{P}/{d['id']}/collect", json={"remarks": "Picked up from desk"})
    assert col.status_code == 200, col.text
    assert col.json()["data"]["status"] == "collected"
    assert col.json()["message"] == "Package collected from gate desk"


def test_protocol_direct_rejection_workflow(as_role, resident_unit_id):
    """Protocol direct_rejection: automatically rejected and cancelled on logging."""
    admin = as_role("community_admin")
    guard = as_role("security_guard")

    r = admin.put(
        f"{P}/protocols",
        json={"delivery_type": "laundry", "protocol_type": "direct_rejection"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["protocol_type"] == "direct_rejection"

    # Create delivery -> rejected and cancelled immediately
    res = guard.post(
        P,
        json={
            "unit_id": resident_unit_id,
            "delivery_type": "laundry",
            "provider_name": "Local Laundry",
        },
    )
    assert res.status_code == 201, res.text
    d = res.json()["data"]
    assert d["approval_status"] == "rejected"
    assert d["status"] == "cancelled"


def _community_protocol(admin: TestClient, delivery_type: str) -> str | None:
    rows = admin.get(f"{P}/protocols").json()["data"]
    for row in rows:
        if row["delivery_type"] == delivery_type and row.get("unit_id") is None:
            return row["protocol_type"]
    return None


def _set_protocol(admin: TestClient, delivery_type: str, protocol_type: str) -> None:
    r = admin.put(
        f"{P}/protocols", json={"delivery_type": delivery_type, "protocol_type": protocol_type}
    )
    assert r.status_code == 200, r.text


def test_resident_approval_delivery_completes_as_delivered_not_collected(
    as_role: Callable[[str], TestClient], resident_unit_id: str
) -> None:
    """Re-audit #3 F5: the default protocol carried `leave_at_gate=True`, so a
    resident-approval delivery finished as `collected` instead of `delivered`."""
    admin, guard = as_role("community_admin"), as_role("security_guard")
    previous = _community_protocol(admin, "courier")
    _set_protocol(admin, "courier", "resident_approval_required")
    # Reproduce the data state that triggered the bug: rows created from the old default
    # (and pre-0044 rows) carry leave_at_gate=True alongside resident_approval_required.
    from sqlalchemy import update

    from app.db.session import SessionLocal
    from app.modules.deliveries.models import DeliveryProtocol

    with SessionLocal() as db:
        db.execute(
            update(DeliveryProtocol)
            .where(
                DeliveryProtocol.delivery_type == "courier",
                DeliveryProtocol.protocol_type == "resident_approval_required",
            )
            .values(leave_at_gate=True)
        )
        db.commit()
    try:
        resident = as_role("resident")
        d = guard.post(P, json={"unit_id": resident_unit_id, "delivery_type": "courier"}).json()[
            "data"
        ]
        assert d["approval_status"] == "pending"
        dec = resident.post(f"{P}/{d['id']}/decision", json={"decision": "approved"})
        assert dec.status_code == 200, dec.text
        assert guard.post(f"{P}/{d['id']}/arrival", json={}).json()["data"]["status"] == "at_gate"
        done = guard.post(f"{P}/{d['id']}/delivered")
        assert done.status_code == 200, done.text
        assert done.json()["data"]["status"] == "delivered"
    finally:
        _set_protocol(admin, "courier", previous or "resident_approval_required")


def test_collect_is_only_for_gate_desk_deliveries_at_the_desk(
    as_role: Callable[[str], TestClient], resident_unit_id: str
) -> None:
    admin, guard = as_role("community_admin"), as_role("security_guard")
    previous = _community_protocol(admin, "grocery")
    try:
        # allow_at_gate -> the parcel goes to the door; the desk cannot "collect" it.
        _set_protocol(admin, "grocery", "allow_at_gate")
        d = guard.post(P, json={"unit_id": resident_unit_id, "delivery_type": "grocery"}).json()[
            "data"
        ]
        guard.post(f"{P}/{d['id']}/arrival", json={})
        r = guard.post(f"{P}/{d['id']}/collect", json={})
        assert r.status_code == 422, r.text
        assert r.json()["error"]["code"] == "NOT_GATE_DESK_DELIVERY"

        # leave_at_gate_desk, but not yet at the desk -> invalid transition.
        _set_protocol(admin, "grocery", "leave_at_gate_desk")
        d2 = guard.post(P, json={"unit_id": resident_unit_id, "delivery_type": "grocery"}).json()[
            "data"
        ]
        r2 = guard.post(f"{P}/{d2['id']}/collect", json={})
        assert r2.status_code == 422, r2.text
        assert r2.json()["error"]["code"] == "INVALID_TRANSITION"
        guard.post(f"{P}/{d2['id']}/arrival", json={})
        ok = guard.post(f"{P}/{d2['id']}/collect", json={})
        assert ok.status_code == 200 and ok.json()["data"]["status"] == "collected"
    finally:
        _set_protocol(admin, "grocery", previous or "resident_approval_required")


def test_delivery_read_exposes_resolved_unit_level_protocol(
    as_role: Callable[[str], TestClient], resident_unit_id: str
) -> None:
    """Re-audit #3 (found by E2E): staff `GET /protocols` lists only community-level rows,
    so the guard console could not see a unit's own protocol. Each delivery now carries
    the `protocol_type` it was routed by."""
    guard, resident = as_role("security_guard"), as_role("resident")
    r = resident.put(
        f"{P}/protocols",
        json={"delivery_type": "laundry", "protocol_type": "leave_at_gate_desk"},
    )
    assert r.status_code == 200, r.text
    try:
        d = guard.post(P, json={"unit_id": resident_unit_id, "delivery_type": "laundry"})
        assert d.status_code == 201, d.text
        body = d.json()["data"]
        assert body["protocol_type"] == "leave_at_gate_desk"
        listed = guard.get(P, params={"page_size": 100}).json()["data"]
        assert {x["id"]: x["protocol_type"] for x in listed}.get(body["id"]) in (
            "leave_at_gate_desk",
            None,  # not on the first page — covered by the detail read below
        )
        assert guard.get(f"{P}/{body['id']}").json()["data"]["protocol_type"] == (
            "leave_at_gate_desk"
        )
    finally:
        # Delete (not re-PUT) the unit-level row: any unit override would change routing
        # for later tests that configure the community-level protocol.
        from sqlalchemy import delete, select, update

        from app.db.session import SessionLocal
        from app.modules.deliveries.models import Delivery, DeliveryProtocol

        with SessionLocal() as db:
            proto_ids = db.scalars(
                select(DeliveryProtocol.id).where(
                    DeliveryProtocol.delivery_type == "laundry",
                    DeliveryProtocol.unit_id == resident_unit_id,
                )
            ).all()
            if proto_ids:
                db.execute(
                    update(Delivery)
                    .where(Delivery.protocol_id.in_(proto_ids))
                    .values(protocol_id=None)
                )
                db.execute(delete(DeliveryProtocol).where(DeliveryProtocol.id.in_(proto_ids)))
            db.commit()


def test_deleting_a_referenced_protocol_nulls_only_protocol_id(
    as_role: Callable[[str], TestClient], resident_unit_id: str
) -> None:
    """Re-audit #4 N-9: the composite FK used to null `community_id` too (NOT NULL -> error)."""
    from sqlalchemy import delete

    from app.db.session import SessionLocal
    from app.modules.deliveries.models import Delivery, DeliveryProtocol

    resident, guard = as_role("resident"), as_role("security_guard")
    r = resident.put(
        f"{P}/protocols", json={"delivery_type": "other", "protocol_type": "allow_at_gate"}
    )
    assert r.status_code == 200, r.text
    d = guard.post(P, json={"unit_id": resident_unit_id, "delivery_type": "other"}).json()["data"]
    assert d["protocol_id"]
    with SessionLocal() as db:
        db.execute(delete(DeliveryProtocol).where(DeliveryProtocol.id == d["protocol_id"]))
        db.commit()
        row = db.get(Delivery, d["id"])
        assert row is not None
        assert row.protocol_id is None
        assert str(row.community_id) == d["community_id"]

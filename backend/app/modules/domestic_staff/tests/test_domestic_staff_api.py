"""Integration tests — Domestic Staff router, RBAC, tenant scope."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit

P = "/api/v1/domestic-staff"


def _phone() -> str:
    return "+9197" + str(uuid.uuid4().int)[:7]


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "domestic_staff"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_admin_creates_staff_and_guard_checks_in(as_role, seed_ids):
    admin = as_role("community_admin")
    r = admin.post(
        P,
        json={"full_name": "Test Maid", "staff_type": "maid", "phone": _phone()},
    )
    assert r.status_code == 201, r.text
    staff_id = r.json()["data"]["id"]

    guard = as_role("security_guard")
    ci = guard.post(f"{P}/attendance/check-in", json={"staff_id": staff_id})
    assert ci.status_code == 201, ci.text
    att_id = ci.json()["data"]["id"]
    assert guard.patch(f"{P}/attendance/{att_id}/check-out").status_code == 200


def test_auditor_cannot_create_staff(as_role):
    # auditor is read-only — no domestic_staff:create
    r = as_role("auditor").post(
        P, json={"full_name": "X", "staff_type": "cook", "phone": "+919700000000"}
    )
    assert r.status_code == 403


def test_resident_rates_staff(as_role, seed_ids):
    admin = as_role("community_admin")
    staff_id = admin.post(
        P, json={"full_name": "Cook", "staff_type": "cook", "phone": _phone()}
    ).json()["data"]["id"]

    resident = as_role("resident")
    r = resident.post(f"{P}/ratings", json={"staff_id": staff_id, "rating": 4})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["rating"] == 4


def test_cross_community_staff_is_404(as_role, seed_ids):
    admin = as_role("community_admin")
    # community_admin is scoped to community_id; ask for a staff in the other community
    r = admin.get(f"{P}/{uuid.uuid4()}")
    assert r.status_code == 404


def test_resident_assigns_staff_and_ends_assignment(as_role, seed_ids, resident_unit_id):
    admin = as_role("community_admin")
    staff = admin.post(
        P,
        json={"full_name": "Resident Maid", "staff_type": "maid", "phone": _phone()},
    ).json()["data"]

    resident = as_role("resident")
    # Resident assigns staff to their unit
    assign_res = resident.post(
        f"{P}/assignments",
        json={
            "staff_id": staff["id"],
            "unit_id": resident_unit_id,
            "work_type": "part_time",
            "days_of_week": ["Mon", "Wed", "Fri"],
        },
    )
    assert assign_res.status_code == 201, assign_res.text
    assignment_id = assign_res.json()["data"]["id"]
    assert assign_res.json()["data"]["days_of_week"] == ["Mon", "Wed", "Fri"]

    # Resident ends assignment
    end_res = resident.post(f"{P}/assignments/{assignment_id}/end")
    assert end_res.status_code == 200, end_res.text
    assert end_res.json()["data"]["is_active"] is False


def test_gate_pass_verification_flow(as_role, seed_ids):
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    staff = admin.post(
        P,
        json={"full_name": "Gate Pass Driver", "staff_type": "driver", "phone": _phone()},
    ).json()["data"]

    guard = as_role("security_guard")
    pass_code = f"GSE:STAFF:{staff['id']}:{cid}"

    # Verify check_in via pass
    v_in = guard.post(
        f"{P}/passes/verify",
        json={"pass_code": pass_code, "action": "check_in"},
    )
    assert v_in.status_code == 200, v_in.text
    data_in = v_in.json()["data"]
    assert data_in["success"] is True
    assert data_in["action"] == "check_in"
    assert data_in["attendance"]["attendance_status"] == "inside"

    # Verify check_out via pass
    v_out = guard.post(
        f"{P}/passes/verify",
        json={"pass_code": pass_code, "action": "check_out"},
    )
    assert v_out.status_code == 200, v_out.text
    data_out = v_out.json()["data"]
    assert data_out["success"] is True
    assert data_out["action"] == "check_out"
    assert data_out["attendance"]["attendance_status"] == "left"


def test_inactive_staff_cannot_check_in(as_role, seed_ids):
    admin = as_role("community_admin")
    staff = admin.post(
        P,
        json={"full_name": "Inactive Gardener", "staff_type": "gardener", "phone": _phone()},
    ).json()["data"]

    # Deactivate staff
    admin.patch(f"{P}/{staff['id']}", json={"is_active": False})

    guard = as_role("security_guard")
    res = guard.post(f"{P}/attendance/check-in", json={"staff_id": staff["id"]})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "STAFF_INACTIVE"


def test_domestic_staff_self_service_endpoints(as_role):
    staff_client = as_role("domestic_staff")
    # All 5 self-service endpoints should return 200 with auto-healing
    me = staff_client.get(f"{P}/me")
    assert me.status_code == 200, me.text
    assert me.json()["data"]["id"] is not None

    assignments = staff_client.get(f"{P}/me/assignments")
    assert assignments.status_code == 200, assignments.text

    pass_res = staff_client.get(f"{P}/me/pass")
    assert pass_res.status_code == 200, pass_res.text
    assert "GSE:STAFF:" in pass_res.json()["data"]["pass_code"]

    att = staff_client.get(f"{P}/me/attendance")
    assert att.status_code == 200, att.text

    visits = staff_client.get(f"{P}/me/visits")
    assert visits.status_code == 200, visits.text


def test_community_admin_deletes_staff(as_role):
    admin = as_role("community_admin")

    # Create a staff member
    r = admin.post(P, json={"full_name": "Temp Cleaner", "staff_type": "maid", "phone": _phone()})
    assert r.status_code == 201, r.text
    staff_id = r.json()["data"]["id"]

    # Verify it exists
    assert admin.get(f"{P}/{staff_id}").status_code == 200

    # Delete it -> 204
    assert admin.delete(f"{P}/{staff_id}").status_code == 204

    # Confirm it's gone -> 404
    assert admin.get(f"{P}/{staff_id}").status_code == 404

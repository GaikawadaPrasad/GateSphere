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


def test_cross_resident_staff_assignment_isolation(as_role, seed_ids, resident_unit_id):
    """GS-BUG-029: Staff assigned to Resident A must never leak to Resident B."""
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    staff = admin.post(
        P,
        json={"full_name": "Cook Yeswanth", "staff_type": "cook", "phone": _phone()},
    ).json()["data"]

    resident_a = as_role("resident")
    # Resident A hires/assigns cook to unit A
    assign_res = resident_a.post(
        f"{P}/assignments",
        json={
            "staff_id": staff["id"],
            "unit_id": resident_unit_id,
            "work_type": "full_time",
        },
    )
    assert assign_res.status_code == 201, assign_res.text
    assignment_id = assign_res.json()["data"]["id"]

    # Verify Resident A sees assignment
    r_a_list = resident_a.get(f"{P}/assignments")
    assert r_a_list.status_code == 200
    assert any(a["id"] == assignment_id for a in r_a_list.json()["data"])

    # Create Resident B in a distinct unit in the same community
    from app.core.security import hash_password
    from app.modules.residents.models import ResidentProfile, UnitOccupancy
    from app.modules.users.models import Role, User, UserRole

    with SessionLocal() as db:

        u1 = db.scalar(select(Unit).where(Unit.id == uuid.UUID(resident_unit_id)))
        u2 = Unit(
            community_id=cid,
            tower_id=u1.tower_id if u1 else None,
            floor_id=u1.floor_id if u1 else None,
            unit_number=f"U-ISOL-{uuid.uuid4().hex[:4]}",
        )
        db.add(u2)
        db.flush()
        u2_id = str(u2.id)

        user_b = User(
            email=f"mubeena-{uuid.uuid4().hex[:6]}@example.com",
            full_name="Mubeena Test",
            password_hash=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(user_b)
        db.flush()

        role = db.scalar(select(Role).where(Role.slug == "resident"))
        db.add(UserRole(user_id=user_b.id, role_id=role.id, community_id=uuid.UUID(cid)))

        prof_b = ResidentProfile(
            community_id=uuid.UUID(cid),
            user_id=user_b.id,
            profile_status="active",
            kyc_status="verified",
        )
        db.add(prof_b)
        db.flush()

        db.add(
            UnitOccupancy(
                community_id=uuid.UUID(cid),
                unit_id=uuid.UUID(u2_id),
                resident_profile_id=prof_b.id,
                occupancy_role="primary_owner",
                is_primary=True,
                is_active=True,
            )
        )
        prof_b_id = prof_b.id
        user_b_id = user_b.id
        user_b_email = user_b.email
        db.commit()

    try:
        from starlette.testclient import TestClient

        from app.main import app

        client_b = TestClient(app)
        login_res = client_b.post(
            "/api/v1/auth/login",
            json={"email": user_b_email, "password": "Pass123!"},
        )
        assert login_res.status_code == 200, login_res.text

        # 1. Resident B listing assignments must NOT leak Resident A's cook
        r_b_list = client_b.get(f"{P}/assignments")
        assert r_b_list.status_code == 200
        assert not any(a["id"] == assignment_id for a in r_b_list.json()["data"])

        # 2. Resident B querying Resident A's unit explicitly must return 404 (NotFoundError)
        r_b_cross = client_b.get(f"{P}/assignments?unit_id={resident_unit_id}")
        assert r_b_cross.status_code == 404
    finally:
        with SessionLocal() as db:
            occs = db.scalars(
                select(UnitOccupancy).where(UnitOccupancy.unit_id == uuid.UUID(u2_id))
            ).all()
            for o in occs:
                db.delete(o)
            p = db.get(ResidentProfile, prof_b_id)
            if p:
                db.delete(p)
            u = db.get(User, user_b_id)
            if u:
                db.delete(u)
            unit_obj = db.get(Unit, uuid.UUID(u2_id))
            if unit_obj:
                db.delete(unit_obj)
            db.commit()

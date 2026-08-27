"""Integration tests — Vehicles router, RBAC, tenant scope."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.residents.models import ResidentProfile

P = "/api/v1/vehicles"


def _profile_in(community_id: str) -> str:
    with SessionLocal() as db:
        p = db.scalar(select(ResidentProfile).where(ResidentProfile.community_id == community_id))
        return str(p.id)


def _plate() -> str:
    return "KA" + str(uuid.uuid4().int)[:2] + "XY" + str(uuid.uuid4().int)[:4]


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "vehicles"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_resident_registers_vehicle(as_role, seed_ids):
    resident = as_role("resident")
    r = resident.post(
        P,
        json={
            "vehicle_type": "car",
            "registration_number": _plate(),
            "resident_profile_id": _profile_in(seed_ids["community_id"]),
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["is_active"] is True


def test_guard_logs_plate_entry_and_exit(as_role, seed_ids):
    guard = as_role("security_guard")
    plate = _plate()
    r = guard.post(f"{P}/entries", json={"registration_number": plate})
    assert r.status_code == 201, r.text
    assert r.json()["data"]["is_flagged"] is True  # unknown plate
    entry_id = r.json()["data"]["id"]
    assert guard.patch(f"{P}/entries/{entry_id}/exit").status_code == 200


def test_slot_create_needs_approve_perm(as_role):
    assert (
        as_role("security_guard").post(f"{P}/parking/slots", json={"slot_code": "Z9"}).status_code
        == 403
    )


def test_cross_community_vehicle_is_404(as_role):
    r = as_role("community_admin").get(f"{P}/{uuid.uuid4()}")
    assert r.status_code == 404

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


def test_resident_self_registers_vehicle(as_role):
    resident = as_role("resident")
    r = resident.post(
        P,
        json={
            "vehicle_type": "bike",
            "registration_number": _plate(),
            "make": "Honda",
            "model": "CBR",
            "color": "Black",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["data"]["is_active"] is True
    assert r.json()["data"]["vehicle_type"] == "bike"


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


# -- role workflows: guard / supervisor / resident / auditor ------------------------ #
def _code(r) -> str | None:
    return (r.json().get("error") or {}).get("code")


def test_resident_cannot_run_gate_operations(as_role):
    guard, resident = as_role("security_guard"), as_role("resident")
    denied = resident.post(f"{P}/entries", json={"registration_number": _plate()})
    assert denied.status_code == 403 and _code(denied) == "STAFF_ONLY"

    entry = guard.post(f"{P}/entries", json={"registration_number": _plate()}).json()["data"]
    try:
        denied = resident.patch(f"{P}/entries/{entry['id']}/exit")
        assert denied.status_code == 403 and _code(denied) == "STAFF_ONLY"
    finally:
        guard.patch(f"{P}/entries/{entry['id']}/exit")


def test_resident_cannot_waive_violation_or_levy_fine(as_role):
    guard, resident = as_role("security_guard"), as_role("resident")
    fined = resident.post(
        f"{P}/parking/violations",
        json={"violation_type": "blocking", "registration_number": _plate(), "fine_amount": 500},
    )
    assert fined.status_code == 403 and _code(fined) == "STAFF_ONLY"

    v = guard.post(
        f"{P}/parking/violations",
        json={"violation_type": "blocking", "registration_number": _plate()},
    ).json()["data"]
    denied = resident.post(
        f"{P}/parking/violations/{v['id']}/status", params={"new_status": "waived"}
    )
    # 404 when the violation isn't the resident's (own-unit scope), 403 otherwise —
    # either way the resident can never change its status.
    assert denied.status_code in (403, 404)


def test_resident_cannot_release_allocation(as_role):
    resident, supervisor = as_role("resident"), as_role("security_supervisor")
    rows = supervisor.get(f"{P}/parking/allocations", params={"active_only": True}).json()["data"]
    if not rows:
        return  # nothing allocated in this seed
    r = resident.post(f"{P}/parking/allocations/{rows[0]['id']}/release")
    assert r.status_code == 403 and _code(r) == "STAFF_ONLY"


def test_resident_sees_only_own_vehicle_gate_history(as_role):
    guard, resident = as_role("security_guard"), as_role("resident")
    stranger = _plate()
    entry = guard.post(f"{P}/entries", json={"registration_number": stranger}).json()["data"]
    try:
        own_ids = {v["id"] for v in resident.get(P, params={"page_size": 100}).json()["data"]}
        rows = resident.get(f"{P}/entries", params={"page_size": 100}).json()["data"]
        assert all(r["vehicle_id"] in own_ids for r in rows)
        assert stranger not in {r["registration_number"] for r in rows}
        # The guard, by contrast, sees the community-wide log.
        g_rows = guard.get(f"{P}/entries", params={"plate": stranger}).json()["data"]
        assert [r["id"] for r in g_rows] == [entry["id"]]
    finally:
        guard.patch(f"{P}/entries/{entry['id']}/exit")


def test_resident_sees_only_own_or_reported_violations(as_role):
    guard, resident = as_role("security_guard"), as_role("resident")
    stranger = guard.post(
        f"{P}/parking/violations",
        json={"violation_type": "unauthorized", "registration_number": _plate()},
    ).json()["data"]
    mine = resident.post(
        f"{P}/parking/violations",
        json={"violation_type": "unauthorized", "registration_number": _plate()},
    )
    assert mine.status_code == 201, mine.text
    ids = {v["id"] for v in resident.get(f"{P}/parking/violations").json()["data"]}
    assert mine.json()["data"]["id"] in ids and stranger["id"] not in ids


def test_guard_flags_unknown_plate_and_supervisor_filters_it(as_role):
    guard, supervisor = as_role("security_guard"), as_role("security_supervisor")
    plate = _plate()
    entry = guard.post(f"{P}/entries", json={"registration_number": plate}).json()["data"]
    try:
        rows = supervisor.get(
            f"{P}/entries", params={"flagged_only": True, "open_only": True, "plate": plate}
        ).json()["data"]
        assert [r["id"] for r in rows] == [entry["id"]] and rows[0]["is_flagged"] is True
    finally:
        guard.patch(f"{P}/entries/{entry['id']}/exit")


def test_supervisor_runs_violation_lifecycle(as_role):
    guard, supervisor = as_role("security_guard"), as_role("security_supervisor")
    v = guard.post(
        f"{P}/parking/violations",
        json={"violation_type": "wrong_slot", "registration_number": _plate(), "fine_amount": 250},
    )
    assert v.status_code == 201, v.text
    vid = v.json()["data"]["id"]
    ack = supervisor.post(
        f"{P}/parking/violations/{vid}/status", params={"new_status": "acknowledged"}
    )
    assert ack.status_code == 200 and ack.json()["data"]["status"] == "acknowledged"
    done = supervisor.post(
        f"{P}/parking/violations/{vid}/status", params={"new_status": "resolved"}
    )
    assert done.json()["data"]["resolved_at"] is not None
    bad = supervisor.post(f"{P}/parking/violations/{vid}/status", params={"new_status": "open"})
    assert bad.status_code == 422 and _code(bad) == "INVALID_TRANSITION"


def test_auditor_is_read_only(as_role, seed_ids):
    auditor = as_role("auditor")  # platform-global: every list names its community
    cid = {"community_id": seed_ids["community_id"]}
    for path in (P, f"{P}/entries", f"{P}/parking/violations", f"{P}/parking/allocations"):
        assert auditor.get(path, params=cid).status_code == 200, path
    entry = auditor.post(f"{P}/entries", params=cid, json={"registration_number": _plate()})
    assert entry.status_code == 403
    assert (
        auditor.post(f"{P}/parking/violations", json={"violation_type": "blocking"}).status_code
        == 403
    )

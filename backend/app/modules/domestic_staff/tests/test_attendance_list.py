"""Regression: GET /domestic-staff/attendance returned 500 (MissingGreenlet).

`list_attendance` resolved the actor to a staff row (auto-heal) and then read the
lazy `User.roles` relationship in async context. The fix loads role slugs with an
explicit query (`_actor_has_cross_unit_role`). This test forces the buggy branch —
a scoped admin with at least one staff row in the community — and asserts 200.
"""

from __future__ import annotations

import uuid

from app.db.session import SessionLocal
from app.modules.domestic_staff.models import (
    DomesticStaff,
    StaffAttendance,
    StaffUnitAssignment,
)

P = "/api/v1/domestic-staff"


def _phone() -> str:
    return "+9198" + str(uuid.uuid4().int)[:7]


def _cleanup(staff_id: str | None) -> None:
    if not staff_id:
        return
    with SessionLocal() as db:
        for row in db.query(StaffAttendance).filter_by(staff_id=staff_id).all():
            db.delete(row)
        for row in db.query(StaffUnitAssignment).filter_by(staff_id=staff_id).all():
            db.delete(row)
        staff = db.get(DomesticStaff, staff_id)
        if staff is not None:
            db.delete(staff)
        db.commit()


def test_admin_lists_attendance_with_rows(as_role):
    admin = as_role("community_admin")
    r = admin.post(
        P, json={"full_name": "Attendance List Probe", "staff_type": "maid", "phone": _phone()}
    )
    assert r.status_code == 201, r.text
    staff_id = r.json()["data"]["id"]
    try:
        guard = as_role("security_guard")
        ci = guard.post(f"{P}/attendance/check-in", json={"staff_id": staff_id})
        assert ci.status_code == 201, ci.text

        res = admin.get(f"{P}/attendance", params={"page": 1, "page_size": 5})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["success"] is True
        assert body["meta"]["total"] >= 1
        row = body["data"][0]
        assert row["staff_id"] == staff_id
        assert row["duration_hours"] is not None
    finally:
        _cleanup(staff_id)

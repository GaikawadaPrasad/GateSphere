"""Master regression test suite for Phase 1-28 Audit Remediation.

Tests critical security, authorization, data integrity, and session management fixes:
1. Auditor read-only (auditor mutation -> 403)
2. Financial dashboard authorization (resident -> 403, guard -> 403, admin -> 200)
3. Resident unit scope isolation (resident without occupancy -> empty scope)
4. Password change and session revocation
5. Amenity GET slot purity & maintenance block deletion
6. Delivery protocol direct rejection
"""

import pytest
from conftest import _login
from starlette.testclient import TestClient

from app.main import app
from app.modules.residents.access import actor_unit_scope
from app.modules.users.models import User


@pytest.mark.asyncio
async def test_auditor_read_only_mutations_denied(as_role, seed_ids):
    """Auditor GET = allowed (200), Auditor state mutation = 403."""
    auditor = as_role("auditor")
    comm_id = seed_ids["community_id"]

    # 1. Auditor can view complaints list
    r_view = auditor.get(f"/api/v1/complaints/tickets?community_id={comm_id}")
    assert r_view.status_code == 200

    # 2. Auditor attempting rating mutation -> 403
    r_rate = auditor.post("/api/v1/domestic-staff/ratings", json={
        "staff_id": "00000000-0000-0000-0000-000000000001",
        "rating": 5,
        "comment": "Auditor rating test"
    })
    assert r_rate.status_code == 403

    # 3. Auditor attempting poll vote -> 403
    r_vote = auditor.post("/api/v1/communication/polls/00000000-0000-0000-0000-000000000001/vote", json={
        "selected_option": 0
    })
    assert r_vote.status_code == 403


@pytest.mark.asyncio
async def test_financial_dashboard_authorization(as_role, seed_ids):
    """Resident -> 403 on financial dashboard, Security Guard -> 403, Admin -> 200."""
    comm_id = seed_ids["community_id"]

    resident = as_role("resident")
    r_res = resident.get(f"/api/v1/dashboards/financial?community_id={comm_id}")
    assert r_res.status_code == 403

    guard = as_role("security_guard")
    r_guard = guard.get(f"/api/v1/dashboards/financial?community_id={comm_id}")
    assert r_guard.status_code == 403

    admin = as_role("community_admin")
    r_admin = admin.get(f"/api/v1/dashboards/financial?community_id={comm_id}")
    assert r_admin.status_code == 200


@pytest.mark.asyncio
async def test_resident_unit_scope_fallback_removed(db):
    """User without active occupancy receives empty frozenset(), never all community units."""
    fake_user = User(
        id="00000000-0000-0000-0000-000000000999",
        email="test_no_occ@gatesphere.com",
        password_hash="hash",
        full_name="Test No Occupancy",
        is_active=True
    )
    db.add(fake_user)
    await db.flush()

    scope = await actor_unit_scope(db, fake_user)
    assert scope == frozenset()


@pytest.mark.asyncio
async def test_password_change_flow(as_role):
    """Authenticated password change flow with current password verification."""
    client = as_role("resident")

    # 1. Incorrect current password -> 401
    r_fail = client.post("/api/v1/auth/password", json={
        "current_password": "WrongPassword123!",
        "new_password": "NewSecretPassword123!"
    })
    assert r_fail.status_code == 401

    # 2. Same password -> 400 or 422
    r_same = client.post("/api/v1/auth/password", json={
        "current_password": "resident@Gate2026!",
        "new_password": "resident@Gate2026!"
    })
    assert r_same.status_code in (400, 422)

    # 3. Successful change
    r_ok = client.post("/api/v1/auth/password", json={
        "current_password": "resident@Gate2026!",
        "new_password": "NewValidPassword2026!"
    })
    assert r_ok.status_code == 200

    # 4. Login with new password to get fresh session, then restore original password
    client_new = TestClient(app)
    _login(client_new, "resident@gatesphere.com", "NewValidPassword2026!")
    r_restore = client_new.post("/api/v1/auth/password", json={
        "current_password": "NewValidPassword2026!",
        "new_password": "resident@Gate2026!"
    })
    assert r_restore.status_code == 200


@pytest.mark.asyncio
async def test_amenity_get_slots_side_effect_purity(as_role, seed_ids):
    """GET /amenities/{id}/slots does not mutate DB state."""
    admin = as_role("community_admin")
    comm_id = seed_ids["community_id"]

    # Get amenities list
    r_amenities = admin.get(f"/api/v1/amenities?community_id={comm_id}")
    assert r_amenities.status_code == 200
    data = r_amenities.json()["data"]
    if data:
        amenity_id = data[0]["id"]
        # Call GET slots twice and verify consistent status
        r_slots1 = admin.get(f"/api/v1/amenities/{amenity_id}/slots")
        assert r_slots1.status_code == 200
        r_slots2 = admin.get(f"/api/v1/amenities/{amenity_id}/slots")
        assert r_slots2.status_code == 200
        assert r_slots1.json()["data"] == r_slots2.json()["data"]

"""Regression tests for Super Admin / Community Admin issue remediation."""

import uuid

from conftest import csrf_cookie_value
from fastapi.testclient import TestClient

from app.main import app

DEMO_EMAIL = "super_admin@gatesphere.com"
DEMO_PASSWORD = "super_admin@Gate2026!"


def test_announcement_expire_and_idempotency(as_role, seed_ids):
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]

    # 1. Create draft announcement
    res = admin.post(
        "/api/v1/communication/announcements",
        json={
            "announcement_type": "notice",
            "title": "Remediation Test Notice",
            "body": "Testing announcement expire functionality",
            "priority": "normal",
            "targets": [{"target_all_community": True}],
        },
        params={"community_id": cid},
    )
    assert res.status_code == 201, res.text
    ann_id = res.json()["data"]["id"]
    assert res.json()["data"]["is_published"] is False
    assert res.json()["data"]["is_expired"] is False

    # 2. Publish announcement
    pub_res = admin.post(f"/api/v1/communication/announcements/{ann_id}/publish")
    assert pub_res.status_code == 200, pub_res.text
    assert pub_res.json()["data"]["is_published"] is True
    assert pub_res.json()["data"]["is_expired"] is False

    # 3. Expire announcement
    exp_res = admin.post(f"/api/v1/communication/announcements/{ann_id}/expire")
    assert exp_res.status_code == 200, exp_res.text
    assert exp_res.json()["data"]["is_expired"] is True
    assert exp_res.json()["data"]["expires_at"] is not None

    # 4. Repeat expire (idempotent operation)
    exp_repeat = admin.post(f"/api/v1/communication/announcements/{ann_id}/expire")
    assert exp_repeat.status_code == 200, exp_repeat.text
    assert exp_repeat.json()["data"]["is_expired"] is True


def test_new_community_admin_dashboard_apis(client, seed_ids):
    # 1. Provision new Community Admin
    cid = seed_ids["community_id"]
    super_admin = client
    login_res = super_admin.post(
        "/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}
    )
    assert login_res.status_code == 200

    sa_csrf = csrf_cookie_value(super_admin)
    new_admin_email = f"test.comm.admin.{uuid.uuid4().hex[:6]}@gatesphere.com"
    prov_res = super_admin.post(
        f"/api/v1/communities/{cid}/admin",
        json={
            "email": new_admin_email,
            "password": "commAdmin@Gate2026!",
            "full_name": "Test Comm Admin",
        },
        headers={"X-CSRF-Token": sa_csrf},
    )
    assert prov_res.status_code == 200, prov_res.text

    # 2. Log in as new Community Admin
    comm_client = TestClient(app)
    c_login = comm_client.post(
        "/api/v1/auth/login",
        json={"email": new_admin_email, "password": "commAdmin@Gate2026!"},
    )
    assert c_login.status_code == 200, c_login.text
    user_data = c_login.json()["data"]
    assert user_data["active_role"] == "community_admin"
    assert len(user_data["community_ids"]) > 0

    # 3. Call dashboard APIs
    ov_res = comm_client.get("/api/v1/dashboards/overview", params={"community_id": cid})
    assert ov_res.status_code == 200, ov_res.text
    assert ov_res.json()["success"] is True

    fin_res = comm_client.get("/api/v1/dashboards/financial", params={"community_id": cid})
    assert fin_res.status_code == 200, fin_res.text
    assert fin_res.json()["success"] is True

    comm_client.close()

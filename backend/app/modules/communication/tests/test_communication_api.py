"""Integration tests — Communication router, RBAC, tenant scope."""

from __future__ import annotations

P = "/api/v1/communication"


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "communication"


def test_announcements_need_auth(client):
    assert client.get(f"{P}/announcements").status_code == 401


def test_resident_sees_published_announcement(as_role):
    r = as_role("resident").get(f"{P}/announcements")
    assert r.status_code == 200
    assert any(a["title"] == "Welcome to GateSphere" for a in r.json()["data"])


def test_resident_cannot_create_announcement(as_role):
    r = as_role("resident").post(f"{P}/announcements", json={"title": "hi", "body": "there"})
    assert r.status_code == 403


def test_admin_announcement_and_poll_flow(as_role, seed_ids):
    admin = as_role("community_admin")
    r = admin.post(
        f"{P}/announcements",
        json={
            "announcement_type": "poll",
            "title": "AGM date poll",
            "body": "Vote your preference",
            "targets": [{"target_all_community": True}],
        },
    )
    assert r.status_code == 201, r.text
    aid = r.json()["data"]["id"]
    assert admin.post(f"{P}/announcements/{aid}/publish").status_code == 200

    p = admin.post(
        f"{P}/polls",
        json={
            "announcement_id": aid,
            "question": "Which Saturday?",
            "options": [{"option_text": "1st"}, {"option_text": "2nd"}],
        },
    )
    assert p.status_code == 201, p.text
    pid = p.json()["data"]["id"]
    opt = p.json()["data"]["options"][0]["id"]
    assert admin.post(f"{P}/polls/{pid}/status", params={"new_status": "open"}).status_code == 200

    resident = as_role("resident")
    v = resident.post(f"{P}/polls/{pid}/vote", json={"option_ids": [opt]})
    assert v.status_code == 201, v.text
    assert v.json()["data"]["total_responses"] == 1

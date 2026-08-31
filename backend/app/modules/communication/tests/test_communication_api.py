"""Integration tests — Communication router, RBAC, tenant scope."""

from __future__ import annotations

P = "/api/v1/communication"


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "communication"


def test_announcements_need_auth(client):
    assert client.get(f"{P}/announcements").status_code == 401


def test_resident_sees_published_announcement(as_role):
    # The shared integration DB accumulates announcements across runs, so the seeded
    # "Welcome to GateSphere" row may be past page 1 — page through until found.
    resident = as_role("resident")
    seen = False
    for page in range(1, 25):
        r = resident.get(f"{P}/announcements", params={"page": page, "page_size": 50})
        assert r.status_code == 200
        rows = r.json()["data"]
        if any(a["title"] == "Welcome to GateSphere" for a in rows):
            seen = True
            break
        if not rows:
            break
    assert seen, "resident cannot see the seeded published 'Welcome to GateSphere' announcement"


def test_resident_cannot_create_announcement(as_role):
    r = as_role("resident").post(f"{P}/announcements", json={"title": "hi", "body": "there"})
    assert r.status_code == 403


def test_publishing_a_broadcast_notifies_residents(as_role, seed_ids):
    """FR-15 / NTF-1: publishing a community-wide notice must create in-app
    notifications for the residents it targets."""
    from sqlalchemy import func, select

    from app.db.session import SessionLocal
    from app.modules.notifications.models import Notification

    admin = as_role("community_admin")
    r = admin.post(
        f"{P}/announcements",
        json={
            "announcement_type": "notice",
            "title": "Water shutdown Saturday",
            "body": "Supply off 10:00-14:00 for tank cleaning.",
            "targets": [{"target_all_community": True}],
        },
    )
    assert r.status_code == 201, r.text
    aid = r.json()["data"]["id"]
    assert admin.post(f"{P}/announcements/{aid}/publish").status_code == 200

    # fan-out runs on the `notifications` Celery queue — invoke the task body directly
    # (it is idempotent; in production `publish` enqueues it with a short countdown).
    from app.modules.communication.tasks import fan_out_announcement

    fan_out_announcement.apply(args=[aid]).get()
    with SessionLocal() as db:
        n = db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.reference_id == aid, Notification.reference_type == "announcement")
        )
    assert n and n > 0, "publishing a community broadcast created no resident notifications"
    # a second fan-out is a no-op (idempotent)
    assert fan_out_announcement.apply(args=[aid]).get()["status"] == "already_sent"


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


def test_multi_question_survey_flow(as_role, seed_ids):
    """GAP-1: a `survey` announcement carries one Poll per question."""
    admin = as_role("community_admin")
    a = admin.post(
        f"{P}/announcements",
        json={
            "announcement_type": "survey",
            "title": "Amenity priorities 2026",
            "body": "Two quick questions",
            "targets": [{"target_all_community": True}],
        },
    )
    assert a.status_code == 201, a.text
    aid = a.json()["data"]["id"]
    assert admin.post(f"{P}/announcements/{aid}/publish").status_code == 200

    for q in ("Upgrade the gym?", "Add a co-working room?"):
        p = admin.post(
            f"{P}/polls",
            json={
                "announcement_id": aid,
                "question": q,
                "options": [{"option_text": "Yes"}, {"option_text": "No"}],
            },
        )
        assert p.status_code == 201, p.text

    # duplicate question text is rejected
    dup = admin.post(
        f"{P}/polls",
        json={
            "announcement_id": aid,
            "question": "Upgrade the gym?",
            "options": [{"option_text": "Yes"}, {"option_text": "No"}],
        },
    )
    assert dup.status_code == 409, dup.text

    s = admin.get(f"{P}/announcements/{aid}/survey")
    assert s.status_code == 200, s.text
    data = s.json()["data"]
    assert data["question_count"] == 2
    assert {q["question"] for q in data["questions"]} == {
        "Upgrade the gym?",
        "Add a co-working room?",
    }

    # survey endpoint rejects a non-survey announcement
    n = admin.post(
        f"{P}/announcements",
        json={
            "announcement_type": "notice",
            "title": "x",
            "body": "y",
            "targets": [{"target_all_community": True}],
        },
    )
    nid = n.json()["data"]["id"]
    assert admin.get(f"{P}/announcements/{nid}/survey").status_code == 422


def test_resident_groups_and_group_target(as_role, seed_ids):
    admin = as_role("community_admin")
    import uuid as _u

    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.users.models import User

    g = admin.post(f"{P}/groups", json={"name": f"Owners-{_u.uuid4().hex[:6]}"})
    assert g.status_code == 201, g.text
    gid = g.json()["data"]["id"]

    with SessionLocal() as db:
        uid = str(db.scalar(select(User).where(User.email == "resident@gatesphere.com")).id)
    m = admin.post(f"{P}/groups/{gid}/members", json={"user_id": uid})
    assert m.status_code == 201, m.text
    assert len(admin.get(f"{P}/groups/{gid}/members").json()["data"]) == 1

    # a user who is not a member of this community cannot be added
    with SessionLocal() as db:
        from app.modules.residents.models import ResidentProfile

        other = db.scalar(
            select(ResidentProfile.user_id).where(
                ResidentProfile.community_id == _u.UUID(seed_ids["other_community_id"])
            )
        )
    assert other is not None
    bad = admin.post(f"{P}/groups/{gid}/members", json={"user_id": str(other)})
    assert bad.status_code == 404, bad.text

    a = admin.post(
        f"{P}/announcements",
        json={
            "title": "Owners only",
            "body": "AGM",
            "targets": [{"resident_group_id": gid}],
        },
    )
    assert a.status_code == 201, a.text
    assert a.json()["data"]["targets"][0]["resident_group_id"] == gid


def test_event_rsvp_flow(as_role, seed_ids):
    """GAP-2: RSVP to a published event announcement + summary."""
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    a = admin.post(
        f"{P}/announcements?community_id={cid}",
        json={
            "announcement_type": "event",
            "title": "AGM 2026",
            "body": "Clubhouse, 6pm",
            "event_start_at": "2026-03-01T18:00:00Z",
            "targets": [{"target_all_community": True}],
        },
    )
    assert a.status_code == 201, a.text
    aid = a.json()["data"]["id"]
    # cannot RSVP before publish
    assert (
        admin.post(f"{P}/announcements/{aid}/rsvp", json={"response": "going"}).status_code == 422
    )
    assert admin.post(f"{P}/announcements/{aid}/publish").status_code == 200

    resident = as_role("resident")
    r = resident.post(f"{P}/announcements/{aid}/rsvp", json={"response": "going", "guests": 2})
    assert r.status_code == 200, r.text
    # update (upsert, not duplicate)
    resident.post(f"{P}/announcements/{aid}/rsvp", json={"response": "maybe"})
    admin.post(f"{P}/announcements/{aid}/rsvp", json={"response": "going"})

    s = admin.get(f"{P}/announcements/{aid}/rsvps").json()["data"]
    assert s["going"] == 1 and s["maybe"] == 1
    assert s["total_attendees"] == 1  # only admin 'going', 0 guests
    assert s["my_response"] == "going"

    # RSVP on a non-event announcement is rejected
    n = admin.post(
        f"{P}/announcements?community_id={cid}",
        json={
            "announcement_type": "notice",
            "title": "x",
            "body": "y",
            "targets": [{"target_all_community": True}],
        },
    )
    nid = n.json()["data"]["id"]
    admin.post(f"{P}/announcements/{nid}/publish")
    assert (
        admin.post(f"{P}/announcements/{nid}/rsvp", json={"response": "going"}).status_code == 422
    )

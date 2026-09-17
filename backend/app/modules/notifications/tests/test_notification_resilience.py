"""Notification failure-resilience (FUNC-001): duplicate events, channel skips,
unauthorized access, validation, and read idempotency — through the public API.

Non-in_app channels are simulated by design (provider = "simulated"); these tests
pin the *recorded* behavior: every dispatch is stored, every channel decision
(delivered / skipped[disabled|quiet]) leaves a delivery row, and inbox mutations
are ownership-checked and idempotent.
"""

from __future__ import annotations

import uuid

from conftest import DEMO_DOMAIN
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.notifications.models import Notification
from app.modules.users.models import User

P = "/api/v1/notifications"


def _resident_id() -> str:
    with SessionLocal() as db:
        return str(db.scalar(select(User.id).where(User.email == f"resident@{DEMO_DOMAIN}")))


def _tracked() -> list[str]:
    return []


def _cleanup(ids: list[str]) -> None:
    with SessionLocal() as db:
        for nid in ids:
            n = db.get(Notification, nid)
            if n is not None:
                db.delete(n)
        db.commit()


def _dispatch(admin, cid: str, **kw) -> dict:
    body = {
        "recipient_user_id": _resident_id(),
        "notification_type": "notice",
        "title": f"resilience-{uuid.uuid4().hex[:6]}",
        "message": "resilience probe",
        "channels": ["in_app"],
        "community_id": cid,
    }
    body.update(kw)
    r = admin.post(f"{P}/dispatch", json=body)
    assert r.status_code == 201, r.text
    return r.json()["data"]


def test_duplicate_dispatch_creates_distinct_rows(as_role, seed_ids):
    """No silent dedup: the same event twice = two inbox rows (replayable log)."""
    admin = as_role("community_admin")
    ids = _tracked()
    try:
        kw = {"title": "same-title", "message": "same-message"}
        ids.append(_dispatch(admin, seed_ids["community_id"], **kw)["id"])
        ids.append(_dispatch(admin, seed_ids["community_id"], **kw)["id"])
        assert ids[0] != ids[1]
    finally:
        _cleanup(ids)


def test_disabled_channel_is_skipped_not_failed(as_role, seed_ids):
    resident = as_role("resident")
    admin = as_role("community_admin")
    ids = _tracked()
    try:
        r = resident.put(f"{P}/me/preferences", json={"channel": "email", "is_enabled": False})
        assert r.status_code == 200, r.text
        try:
            note = _dispatch(admin, seed_ids["community_id"], channels=["email"])
            ids.append(note["id"])
            by_channel = {d["channel"]: d for d in note["deliveries"]}
            assert by_channel["email"]["status"] == "skipped"
            assert "disabled" in (by_channel["email"]["failure_reason"] or "")
        finally:
            resident.put(f"{P}/me/preferences", json={"channel": "email", "is_enabled": True})
    finally:
        _cleanup(ids)


def test_quiet_hours_channel_is_skipped(as_role, seed_ids):
    resident = as_role("resident")
    admin = as_role("community_admin")
    ids = _tracked()
    try:
        r = resident.put(
            f"{P}/me/preferences",
            json={
                "channel": "sms",
                "is_enabled": True,
                "quiet_hours_start": "00:00:00",
                "quiet_hours_end": "23:59:59",
            },
        )
        assert r.status_code == 200, r.text
        try:
            note = _dispatch(admin, seed_ids["community_id"], channels=["sms"])
            ids.append(note["id"])
            by_channel = {d["channel"]: d for d in note["deliveries"]}
            assert by_channel["sms"]["status"] == "skipped"
            assert "quiet" in (by_channel["sms"]["failure_reason"] or "")
        finally:
            resident.put(
                f"{P}/me/preferences",
                json={"channel": "sms", "quiet_hours_start": None, "quiet_hours_end": None},
            )
    finally:
        _cleanup(ids)


def test_cross_user_read_is_404(as_role, seed_ids):
    """An auditor (has notifications:view) still cannot open another user's inbox row."""
    admin = as_role("community_admin")
    ids = _tracked()
    try:
        ids.append(_dispatch(admin, seed_ids["community_id"])["id"])
        auditor = as_role("auditor")
        assert auditor.get(f"{P}/{ids[0]}").status_code == 404
        assert auditor.post(f"{P}/{ids[0]}/read").status_code == 404
    finally:
        _cleanup(ids)


def test_dispatch_validates_recipient_and_content(as_role, seed_ids):
    admin = as_role("community_admin")
    cid = seed_ids["community_id"]
    r = admin.post(
        f"{P}/dispatch",
        json={
            "recipient_user_id": str(uuid.uuid4()),
            "notification_type": "notice",
            "title": "t",
            "message": "m",
            "channels": ["in_app"],
            "community_id": cid,
        },
    )
    assert r.status_code == 404
    r = admin.post(
        f"{P}/dispatch",
        json={
            "recipient_user_id": _resident_id(),
            "notification_type": "notice",
            "channels": ["in_app"],
            "community_id": cid,
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "CONTENT_REQUIRED"


def test_read_is_idempotent_and_empty_mark_all_is_zero(as_role, seed_ids):
    admin = as_role("community_admin")
    resident = as_role("resident")
    ids = _tracked()
    try:
        ids.append(_dispatch(admin, seed_ids["community_id"])["id"])
        assert resident.post(f"{P}/{ids[0]}/read").status_code == 200
        again = resident.post(f"{P}/{ids[0]}/read")
        assert again.status_code == 200
        assert again.json()["data"]["is_read"] is True
    finally:
        _cleanup(ids)
    auditor = as_role("auditor")
    r = auditor.post(f"{P}/mark-all-read")
    assert r.status_code == 200
    assert r.json()["data"]["marked"] == 0

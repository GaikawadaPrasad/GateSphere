"""Integration tests — Complaints router, RBAC, tenant scope."""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Unit
from app.modules.complaints.models import ServiceCategory

P = "/api/v1/complaints"


def _unit_in(community_id: str) -> str:
    with SessionLocal() as db:
        u = db.scalar(
            select(Unit).where(Unit.community_id == community_id).order_by(Unit.unit_number)
        )
        return str(u.id)


def _category_in(community_id: str) -> str:
    with SessionLocal() as db:
        cat = db.scalar(
            select(ServiceCategory)
            .where(ServiceCategory.community_id == community_id)
            .order_by(ServiceCategory.code)
        )
        return str(cat.id)


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "complaints"


def test_tickets_need_auth(client):
    assert client.get(f"{P}/tickets").status_code == 401


def test_resident_raises_fm_resolves_resident_confirms(as_role, seed_ids):
    cid = seed_ids["community_id"]
    resident = as_role("resident")
    r = resident.post(
        f"{P}/tickets",
        json={"unit_id": _unit_in(cid), "category_id": _category_in(cid), "subject": "No water"},
    )
    assert r.status_code == 201, r.text
    tid = r.json()["data"]["id"]

    fm = as_role("facility_manager")
    assert fm.post(f"{P}/tickets/{tid}/assign", json={"vendor_name": "Acme"}).status_code == 200
    assert (
        fm.post(f"{P}/tickets/{tid}/transition", json={"status": "in_progress"}).status_code == 200
    )
    assert fm.post(f"{P}/tickets/{tid}/transition", json={"status": "resolved"}).status_code == 200

    got = resident.post(f"{P}/tickets/{tid}/confirm", json={"confirmation_status": "confirmed"})
    assert got.status_code == 200 and got.json()["data"]["status"] == "closed"
    assert resident.post(f"{P}/tickets/{tid}/feedback", json={"rating": 5}).status_code == 201


def test_resident_cannot_create_category(as_role):
    assert (
        as_role("resident").post(f"{P}/categories", json={"code": "X", "name": "X"}).status_code
        == 403
    )


def test_cross_community_unit_is_404(as_role, seed_ids):
    resident = as_role("resident")
    other = _unit_in(seed_ids["other_community_id"])
    cat = _category_in(seed_ids["community_id"])
    r = resident.post(f"{P}/tickets", json={"unit_id": other, "category_id": cat, "subject": "x"})
    assert r.status_code == 404


def test_attachments(as_role, seed_ids):
    cid = seed_ids["community_id"]
    resident = as_role("resident")
    tid = resident.post(
        f"{P}/tickets",
        json={"unit_id": _unit_in(cid), "category_id": _category_in(cid), "subject": "Photo"},
    ).json()["data"]["id"]
    _u = "http://localhost:9000/gatesphere-local/complaints/attachments/x/a.jpg"
    r = resident.post(
        f"{P}/tickets/{tid}/attachments",
        json={"file_url": _u, "file_name": "a.jpg", "mime_type": "image/jpeg"},
    )
    assert r.status_code == 201, r.text
    lst = resident.get(f"{P}/tickets/{tid}/attachments")
    assert lst.status_code == 200 and lst.json()["data"][0]["file_name"] == "a.jpg"

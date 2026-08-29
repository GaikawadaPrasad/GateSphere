"""Integration tests — upload pipeline (presign, catalogue enforcement)."""

from __future__ import annotations

P = "/api/v1/uploads"


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "uploads"


def test_presign_needs_auth(client):
    assert client.post(P, json={}).status_code in (401, 403, 422)


def test_presign_happy_path(as_role, seed_ids):
    r = as_role("security_guard").post(
        P,
        json={
            "kind": "visitor_photo",
            "filename": "front door.JPG",
            "content_type": "image/jpeg",
            "size_bytes": 200_000,
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["kind"] == "visitor_photo"
    assert d["key"].startswith(f"visitors/photos/{seed_ids['community_id']}/")
    assert d["key"].endswith(".jpg")
    assert d["file_url"].startswith("http://localhost:9000/gatesphere-local/")
    assert d["upload_url"].startswith("http")
    assert d["required_headers"]["Content-Type"] == "image/jpeg"
    assert d["file_id"] and d["confirm_url"].endswith(f"/uploads/{d['file_id']}/confirm")


def _presign(client, seed_ids, *, kind="visitor_photo", content_type="image/jpeg"):
    return client.post(
        P,
        json={
            "kind": kind,
            "filename": "f.bin",
            "content_type": content_type,
            "size_bytes": 64,
            "community_id": seed_ids["community_id"],
        },
    ).json()["data"]


def test_confirm_accepts_a_real_image(as_role, seed_ids):
    from app.services import storage

    guard = as_role("security_guard")
    d = _presign(guard, seed_ids)
    storage.put_object(d["key"], b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"x" * 40, "image/jpeg")
    c = guard.post(f"{P}/{d['file_id']}/confirm")
    assert c.status_code == 200, c.text
    assert c.json()["data"]["status"] == "confirmed"
    assert c.json()["data"]["detected_content_type"] == "image/jpeg"


def test_confirm_rejects_disguised_payload(as_role, seed_ids):
    from app.services import storage

    guard = as_role("security_guard")
    d = _presign(guard, seed_ids, content_type="image/png")
    # a script uploaded with an image content-type
    storage.put_object(d["key"], b"<?php system($_GET[0]); ?>\n", "image/png")
    c = guard.post(f"{P}/{d['file_id']}/confirm")
    assert c.status_code == 422
    assert c.json()["error"]["code"] == "UPLOAD_REJECTED"


def test_confirm_without_upload_fails(as_role, seed_ids):
    guard = as_role("security_guard")
    d = _presign(guard, seed_ids)
    c = guard.post(f"{P}/{d['file_id']}/confirm")
    assert c.status_code == 422
    assert c.json()["error"]["code"] == "NO_OBJECT"


def test_rejects_wrong_content_type(as_role, seed_ids):
    r = as_role("security_guard").post(
        P,
        json={
            "kind": "visitor_photo",
            "filename": "x.exe",
            "content_type": "application/x-msdownload",
            "size_bytes": 10,
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "CONTENT_TYPE_NOT_ALLOWED"


def test_rejects_oversize(as_role, seed_ids):
    r = as_role("security_guard").post(
        P,
        json={
            "kind": "visitor_photo",
            "filename": "big.png",
            "content_type": "image/png",
            "size_bytes": 50 * 1024 * 1024,
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_unknown_kind_is_404(as_role, seed_ids):
    r = as_role("security_guard").post(
        P,
        json={
            "kind": "nope",
            "filename": "x.png",
            "content_type": "image/png",
            "size_bytes": 10,
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 404


def test_domain_endpoint_rejects_external_url(as_role, seed_ids, resident_unit_id):
    # a ticket attachment must point at our bucket
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.complaints.models import ServiceCategory

    cid = seed_ids["community_id"]
    unit = resident_unit_id  # a resident may only raise tickets for their own unit
    with SessionLocal() as db:
        cat = str(
            db.scalar(
                select(ServiceCategory)
                .where(ServiceCategory.community_id == cid)
                .order_by(ServiceCategory.code)
            ).id
        )
    resident = as_role("resident")
    tid = resident.post(
        "/api/v1/complaints/tickets",
        json={"unit_id": unit, "category_id": cat, "subject": "x"},
    ).json()["data"]["id"]
    r = resident.post(
        f"/api/v1/complaints/tickets/{tid}/attachments",
        json={"file_url": "http://evil.example/x.jpg", "file_name": "x.jpg"},
    )
    assert r.status_code == 422


def test_download_is_authorized_by_managed_file_not_just_key(as_role, seed_ids):
    """IDOR: /uploads/download must gate on the managed_files row, not merely the key."""
    import uuid as _uuid

    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.modules.uploads.models import ManagedFile
    from app.services import storage

    guard = as_role("security_guard")
    d = _presign(guard, seed_ids)
    storage.put_object(d["key"], b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"x" * 40, "image/jpeg")
    assert guard.post(f"{P}/{d['file_id']}/confirm").status_code == 200

    # the uploader can get a presigned GET for their own confirmed file
    good = guard.get(f"{P}/download", params={"key": d["key"]})
    assert good.status_code == 200 and good.json()["data"]["url"].startswith("http")

    # a confirmed object that belongs to ANOTHER community
    other_cid = seed_ids["other_community_id"]
    foreign_key = f"visitors/photos/{other_cid}/{_uuid.uuid4().hex}-x.jpg"
    storage.put_object(foreign_key, b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"x" * 40, "image/jpeg")
    with SessionLocal() as db:
        db.add(
            ManagedFile(
                community_id=_uuid.UUID(other_cid),
                object_key=foreign_key,
                kind="visitor_photo",
                declared_content_type="image/jpeg",
                declared_size_bytes=48,
                status="confirmed",
                detected_content_type="image/jpeg",
                size_bytes=48,
            )
        )
        db.commit()
    try:
        # the object exists and the key is known, but it is not in the caller's community
        r = guard.get(f"{P}/download", params={"key": foreign_key})
        assert r.status_code == 404, r.text
    finally:
        with SessionLocal() as db:
            row = db.scalar(select(ManagedFile).where(ManagedFile.object_key == foreign_key))
            if row:
                db.delete(row)
                db.commit()
        storage.delete_object(foreign_key)

    # an unknown key and a pending (unconfirmed) upload are both 404
    assert guard.get(f"{P}/download", params={"key": "x/y/z.jpg"}).status_code == 404
    d2 = _presign(guard, seed_ids)
    assert guard.get(f"{P}/download", params={"key": d2["key"]}).status_code == 404

"""Tenant-scope regression tests for the transitional in-memory special-assessments
store (`app/modules/billing/router.py`).

The store has no table/RLS backstop, so the router itself must enforce §3:
explicit community ids are resolved through the caller's TenantScope
(out-of-scope → 404, never 403/200), creation requires `billing:create`
(not just `billing:view`), and rows stamped with another community are
invisible by id.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.communities.models import Community
from app.modules.users.models import User, UserRole

DOMAIN = "gatesphere.com"


def _own_and_foreign_community_ids() -> tuple[str, str]:
    with SessionLocal() as db:
        ca = db.scalar(select(User).where(User.email == f"community_admin@{DOMAIN}"))
        mine = set(db.scalars(select(UserRole.community_id).where(UserRole.user_id == ca.id)).all())
        own = next(iter(mine))
        for c in db.scalars(select(Community)).all():
            if c.id not in mine:
                return str(own), str(c.id)
    pytest.skip("seed needs two communities for the assessments scope tests")


def _payload(title: str) -> dict:
    return {
        "title": title,
        "purpose": "CapEx Infrastructure",
        "description": "scope regression probe",
        "target_amount": "1000.00",
        "affected_units_count": 10,
    }


def test_create_in_own_community_ok(as_role):
    own, _ = _own_and_foreign_community_ids()
    ca = as_role("community_admin")
    r = ca.post(
        "/api/v1/billing/assessments",
        params={"community_id": own},
        json=_payload("own-community assessment"),
    )
    try:
        assert r.status_code == 201, r.text
        assert r.json()["data"]["community_id"] == own
    finally:
        _drop(r.json()["data"]["id"] if r.status_code == 201 else None)


def _drop(sa_id: str | None) -> None:
    if not sa_id:
        return
    from app.modules.billing.router import _SPECIAL_ASSESSMENTS_STORE

    _SPECIAL_ASSESSMENTS_STORE.pop(sa_id, None)


def test_create_in_foreign_community_404(as_role):
    _, foreign = _own_and_foreign_community_ids()
    ca = as_role("community_admin")
    r = ca.post(
        "/api/v1/billing/assessments",
        params={"community_id": foreign},
        json=_payload("foreign-community assessment"),
    )
    assert r.status_code == 404, f"cross-tenant assessment write (status {r.status_code})"


def test_create_in_foreign_community_via_body_404(as_role):
    _, foreign = _own_and_foreign_community_ids()
    ca = as_role("community_admin")
    body = _payload("foreign-body assessment")
    body["community_id"] = foreign
    r = ca.post("/api/v1/billing/assessments", json=body)
    assert r.status_code == 404, f"cross-tenant assessment write via body (status {r.status_code})"


def test_list_with_foreign_community_id_404(as_role):
    _, foreign = _own_and_foreign_community_ids()
    ca = as_role("community_admin")
    r = ca.get("/api/v1/billing/assessments", params={"community_id": foreign})
    assert r.status_code == 404, f"cross-tenant assessment list (status {r.status_code})"


def test_foreign_row_invisible_by_id(as_role):
    """A row stamped with the foreign community is 404 for get/approve/reject."""
    own, foreign = _own_and_foreign_community_ids()
    admin = as_role("super_admin")
    r = admin.post(
        "/api/v1/billing/assessments",
        params={"community_id": foreign},
        json=_payload("foreign row for visibility probe"),
    )
    assert r.status_code == 201, r.text
    sa_id = r.json()["data"]["id"]
    try:
        ca = as_role("community_admin")
        assert ca.get(f"/api/v1/billing/assessments/{sa_id}").status_code == 404
        assert ca.post(f"/api/v1/billing/assessments/{sa_id}/approve", json={}).status_code == 404
        assert ca.post(f"/api/v1/billing/assessments/{sa_id}/reject", json={}).status_code == 404
        # control: the owning scope can still see it
        assert admin.get(f"/api/v1/billing/assessments/{sa_id}").status_code == 200
        _ = own
    finally:
        _drop(sa_id)


def test_create_requires_create_permission(as_role):
    """`auditor` holds billing:view but not billing:create → 403 (was VIEW-gated)."""
    own, _ = _own_and_foreign_community_ids()
    auditor = as_role("auditor")
    r = auditor.post(
        "/api/v1/billing/assessments",
        params={"community_id": own},
        json=_payload("auditor write probe"),
    )
    assert r.status_code == 403, f"auditor wrote an assessment (status {r.status_code})"

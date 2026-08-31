"""Stage-3 consolidated cross-tenant IDOR sweep.

For every major community-owned entity: find a row that belongs to a community the
`community_admin@` user is **not** a member of, then prove that user gets `404`
(never `403`, never `200`) when addressing it by id through the public API.

This complements the per-module `test_*_api.py` cross-tenant checks and the DB-level
`test_tenant_isolation.py` RLS proof — it is the single place that asserts the whole
surface at once, so a regression in any one module's repository scoping is caught here.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.users.models import User, UserRole

DOMAIN = "gatesphere.com"


def _foreign_community_id() -> str:
    """A community id the seeded community_admin@ is NOT a member of."""
    with SessionLocal() as db:
        ca = db.scalar(select(User).where(User.email == f"community_admin@{DOMAIN}"))
        mine = set(db.scalars(select(UserRole.community_id).where(UserRole.user_id == ca.id)).all())
        from app.modules.communities.models import Community

        for c in db.scalars(select(Community)).all():
            if c.id not in mine:
                return str(c.id)
    pytest.skip("seed has only one community — cross-tenant sweep needs two")


def _first_id(model, community_id: str, order_col: str | None = None):
    with SessionLocal() as db:
        stmt = select(model).where(model.community_id == community_id)
        row = db.scalars(stmt).first()
        return str(row.id) if row else None


# (label, "GET path template", model import path, model attr)
def _cases():
    from app.modules.amenities.models import Amenity, AmenityBooking
    from app.modules.billing.models import MaintenanceInvoice, Payment
    from app.modules.communication.models import Announcement
    from app.modules.communities.models import Tower, Unit
    from app.modules.complaints.models import ServiceTicket
    from app.modules.deliveries.models import Delivery
    from app.modules.domestic_staff.models import DomesticStaff
    from app.modules.incidents.models import SecurityIncident
    from app.modules.residents.models import ResidentProfile
    from app.modules.vehicles.models import Vehicle
    from app.modules.visitors.models import VisitorRequest

    Invoice = MaintenanceInvoice

    return [
        ("tower", "/api/v1/communities/towers/{id}", Tower),
        ("unit", "/api/v1/communities/units/{id}", Unit),
        ("resident_profile", "/api/v1/residents/{id}", ResidentProfile),
        ("visitor_request", "/api/v1/visitors/requests/{id}", VisitorRequest),
        ("delivery", "/api/v1/deliveries/{id}", Delivery),
        ("domestic_staff", "/api/v1/domestic-staff/{id}", DomesticStaff),
        ("vehicle", "/api/v1/vehicles/{id}", Vehicle),
        ("invoice", "/api/v1/billing/invoices/{id}", Invoice),
        ("payment", "/api/v1/billing/payments/{id}", Payment),
        ("ticket", "/api/v1/complaints/tickets/{id}", ServiceTicket),
        # amenities has no `GET /amenities/{id}` (only PATCH) — probe a nested GET that exists
        ("amenity_slots", "/api/v1/amenities/{id}/slots", Amenity),
        ("booking", "/api/v1/amenities/bookings/{id}", AmenityBooking),
        ("announcement", "/api/v1/communication/announcements/{id}", Announcement),
        ("incident", "/api/v1/incidents/{id}", SecurityIncident),
    ]


@pytest.mark.parametrize("case", _cases(), ids=lambda c: c[0])
def test_community_admin_cannot_read_foreign_entity_by_id(as_role, case):
    label, tmpl, model = case
    foreign = _foreign_community_id()
    obj_id = _first_id(model, foreign)
    if obj_id is None:
        pytest.skip(f"no seeded {label} in the foreign community")
    ca = as_role("community_admin")
    r = ca.get(tmpl.format(id=obj_id))
    assert r.status_code == 404, (
        f"{label}: community_admin saw a foreign-community row "
        f"(status {r.status_code}) — tenant isolation leak"
    )


@pytest.mark.parametrize("case", _cases(), ids=lambda c: c[0])
def test_security_guard_cannot_read_foreign_entity_by_id(as_role, case):
    label, tmpl, model = case
    foreign = _foreign_community_id()
    obj_id = _first_id(model, foreign)
    if obj_id is None:
        pytest.skip(f"no seeded {label} in the foreign community")
    guard = as_role("security_guard")
    r = guard.get(tmpl.format(id=obj_id))
    assert r.status_code in (403, 404), f"{label}: guard status {r.status_code}"


def test_community_admin_cannot_create_invoice_in_foreign_community(as_role):
    """Passing a foreign community_id in the POST body must not create a row there."""
    foreign = _foreign_community_id()
    from app.modules.communities.models import Unit

    foreign_unit = _first_id(Unit, foreign)
    if foreign_unit is None:
        pytest.skip("no seeded unit in foreign community")
    ca = as_role("community_admin")
    r = ca.post(
        "/api/v1/billing/invoices",
        json={
            "community_id": foreign,
            "unit_id": foreign_unit,
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
            "lines": [{"charge_head_code": "MAINT", "description": "x", "amount": "100.00"}],
        },
    )
    assert r.status_code in (403, 404, 422), (
        f"community_admin created/negotiated an invoice into a foreign community "
        f"(status {r.status_code})"
    )

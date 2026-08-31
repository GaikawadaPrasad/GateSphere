"""Synthetic seed data.

Run:
  `python -m app.scripts.seed`            — idempotent top-up (safe to re-run).
  `python -m app.scripts.seed --reset`    — TRUNCATE every data table first, then seed.

Idempotency note: a plain re-run is idempotent **against a consistently-populated DB**
(each block skips work it already did). It is *not* robust to a DB that has been
**partially** wiped (e.g. `TRUNCATE maintenance_invoices` but not the rows that depend
on it) — use `--reset` for that, or `alembic downgrade base && alembic upgrade head`.

Per the PRD: empty screens are prohibited. This seeds RBAC + 2 communities, 4 towers,
8 floors, 50+ units, plus a demo user per role. Extend module-by-module as models land.
"""

from __future__ import annotations

import sys

import structlog
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.rbac import PERMISSIONS, ROLE_PERMISSIONS, ROLES
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.modules.communities.models import Community, Floor, Gate, Tower, Unit
from app.modules.users.models import Permission, Role, RolePermission, User, UserRole

log = structlog.get_logger(__name__)

DEMO_DOMAIN = "gatesphere.com"
# Local demo credentials only. Per-role password: "<role>@Gate2026!"
# e.g. super_admin@gatesphere.com / super_admin@Gate2026!
DEMO_PASSWORD_SUFFIX = "@Gate2026!"


def demo_password(role_slug: str) -> str:
    return f"{role_slug}{DEMO_PASSWORD_SUFFIX}"


def _get_or_create(db: Session, model, defaults=None, **filters):
    obj = db.scalar(select(model).filter_by(**filters))
    if obj:
        return obj, False
    obj = model(**filters, **(defaults or {}))
    db.add(obj)
    db.flush()
    return obj, True


def seed_rbac(db: Session) -> None:
    perms = {}
    for code, desc in PERMISSIONS.items():
        p, _ = _get_or_create(db, Permission, code=code, defaults={"description": desc})
        perms[code] = p
    for slug, name in ROLES.items():
        role, _ = _get_or_create(db, Role, slug=slug, defaults={"name": name})
        granted = ROLE_PERMISSIONS.get(slug, [])
        codes = PERMISSIONS.keys() if granted == ["*"] else granted
        for code in codes:
            _get_or_create(db, RolePermission, role_id=role.id, permission_id=perms[code].id)


_COMMUNITY_NAMES = ["Green Park Enclave", "Sunrise Heights"]


def seed_property(db: Session) -> list[Community]:
    communities = []
    for ci in range(1, 3):
        c, _ = _get_or_create(
            db,
            Community,
            code=f"gs-{ci:02d}",
            defaults={
                "name": _COMMUNITY_NAMES[ci - 1],
                "address_line1": f"{ci} Sphere Avenue",
                "city": "Hyderabad",
                "state": "Telangana",
                "postal_code": f"5000{ci:02d}",
            },
        )
        communities.append(c)
        for gi, gtype in enumerate(("main", "service"), start=1):
            _get_or_create(
                db,
                Gate,
                community_id=c.id,
                code=f"G{gi}",
                defaults={"name": f"{gtype.title()} Gate", "gate_type": gtype},
            )
        for ti in range(1, 3):  # 2 towers each -> 4 towers
            letter = chr(64 + ti)
            t, _ = _get_or_create(
                db,
                Tower,
                community_id=c.id,
                name=f"Tower {letter}",
                defaults={"code": f"T{letter}", "structure_type": "tower", "total_floors": 2},
            )
            for fn in range(1, 3):  # 2 floors each -> 8 floors
                f, _ = _get_or_create(
                    db,
                    Floor,
                    community_id=c.id,
                    tower_id=t.id,
                    floor_number=fn,
                    defaults={"label": f"Floor {fn}"},
                )
                for un in range(1, 8):  # 7 units/floor -> 56 units
                    _get_or_create(
                        db,
                        Unit,
                        community_id=c.id,
                        tower_id=t.id,
                        floor_id=f.id,
                        unit_number=f"{letter}-{fn}{un:02d}",
                        defaults={"unit_type": "apartment", "bedrooms": 2, "area_sqft": 1150},
                    )
    return communities


def seed_users(db: Session, communities: list[Community]) -> None:
    roles = {r.slug: r for r in db.scalars(select(Role)).all()}
    for slug in ROLES:
        email = f"{slug}@{DEMO_DOMAIN}"
        user, created = _get_or_create(
            db,
            User,
            email=email,
            defaults={
                "full_name": slug.replace("_", " ").title(),
                "password_hash": hash_password(demo_password(slug)),
                "is_superadmin": slug == "super_admin",
            },
        )
        if not created:
            user.password_hash = hash_password(demo_password(slug))
        scope = None if slug in ("super_admin", "auditor") else communities[0].id
        _get_or_create(db, UserRole, user_id=user.id, role_id=roles[slug].id, community_id=scope)

    # Non-interactive actor for Celery scheduled jobs (SLA sweeps, dues reminders, …).
    # No role grants — jobs use a global TenantScope; this row only attributes audit logs.
    _get_or_create(
        db,
        User,
        email=f"system@{DEMO_DOMAIN}",
        defaults={
            "full_name": "System (automation)",
            "password_hash": hash_password(f"system{DEMO_PASSWORD_SUFFIX}"),
            "is_active": False,
        },
    )


def seed_residents(db: Session, communities: list[Community]) -> None:
    from app.modules.communities.models import Unit
    from app.modules.residents.models import (
        EmergencyContact,
        ResidentProfile,
        UnitOccupancy,
    )

    for c in communities:
        units = db.scalars(
            select(Unit).where(Unit.community_id == c.id).order_by(Unit.unit_number).limit(6)
        ).all()
        for i, unit in enumerate(units, start=1):
            email = f"resident{i}.{c.code}@{DEMO_DOMAIN}"
            user, _ = _get_or_create(
                db,
                User,
                email=email,
                defaults={
                    "full_name": f"Resident {i} ({c.code})",
                    "password_hash": hash_password("Resident#2026"),
                },
            )
            profile, created = _get_or_create(
                db,
                ResidentProfile,
                community_id=c.id,
                user_id=user.id,
                defaults={"profile_status": "active", "kyc_status": "verified"},
            )
            _get_or_create(
                db,
                UnitOccupancy,
                community_id=c.id,
                unit_id=unit.id,
                resident_profile_id=profile.id,
                defaults={"occupancy_role": "primary_owner", "is_primary": True},
            )
            if created:
                db.add(
                    EmergencyContact(
                        community_id=c.id,
                        resident_profile_id=profile.id,
                        name=f"Kin of Resident {i}",
                        relationship_type="spouse",
                        phone="+91 90000 0000" + str(i),
                        priority=1,
                    )
                )

    # Give the demo `resident@` role account a home in community 0 (used by tests / UI).
    demo = db.scalar(select(User).where(User.email == f"resident@{DEMO_DOMAIN}"))
    if demo is not None and communities:
        c0 = communities[0]
        # 7th unit ascending — outside the first-6 seeded residents and the last unit
        # that residents-module tests exercise.
        home = db.scalars(
            select(Unit)
            .where(Unit.community_id == c0.id)
            .order_by(Unit.unit_number)
            .offset(6)
            .limit(1)
        ).first()
        dp, _ = _get_or_create(
            db,
            ResidentProfile,
            community_id=c0.id,
            user_id=demo.id,
            defaults={"profile_status": "active", "kyc_status": "verified"},
        )
        if home is not None:
            _get_or_create(
                db,
                UnitOccupancy,
                community_id=c0.id,
                unit_id=home.id,
                resident_profile_id=dp.id,
                defaults={"occupancy_role": "primary_owner", "is_primary": True},
            )


def seed_visitors(db: Session, communities: list[Community]) -> None:
    from app.modules.visitors.models import Visitor, VisitorPolicy

    for c in communities:
        _get_or_create(db, VisitorPolicy, community_id=c.id, defaults={})
        for i, name in enumerate(("Arjun Mehta", "Priya Iyer", "Zomato Delivery"), start=1):
            _get_or_create(
                db,
                Visitor,
                community_id=c.id,
                phone=f"+9198{c.code[-2:]}00{i:04d}",
                defaults={"full_name": name},
            )


def seed_gate(db: Session, communities: list[Community]) -> None:
    from datetime import date, time

    from app.modules.communities.models import Gate
    from app.modules.gate.models import GateAssignment, GateEvent, GuardRoster

    guard = db.scalar(select(User).where(User.email == f"security_guard@{DEMO_DOMAIN}"))
    supervisor = db.scalar(select(User).where(User.email == f"security_supervisor@{DEMO_DOMAIN}"))
    if guard is None:
        return
    for c in communities:
        gate = db.scalar(select(Gate).where(Gate.community_id == c.id).order_by(Gate.code))
        roster, created = _get_or_create(
            db,
            GuardRoster,
            community_id=c.id,
            guard_user_id=guard.id,
            shift_date=date(2026, 8, 28),
            shift_start=time(8, 0),
            defaults={
                "shift_end": time(20, 0),
                "supervisor_user_id": supervisor.id if supervisor else None,
                "status": "active",
            },
        )
        if created and gate is not None:
            db.add(
                GateAssignment(
                    community_id=c.id,
                    guard_user_id=guard.id,
                    gate_id=gate.id,
                    roster_id=roster.id,
                )
            )
            db.add(
                GateEvent(
                    community_id=c.id,
                    gate_id=gate.id,
                    actor_user_id=guard.id,
                    event_type="gate_open",
                )
            )


def seed_domestic_staff(db: Session, communities: list[Community]) -> None:
    from app.modules.communities.models import Unit
    from app.modules.domestic_staff.models import DomesticStaff, StaffUnitAssignment

    for c in communities:
        unit = db.scalar(select(Unit).where(Unit.community_id == c.id).order_by(Unit.unit_number))
        for i, (name, kind) in enumerate(
            [("Lakshmi Bai", "maid"), ("Ravi Kumar", "cook"), ("Suresh Yadav", "driver")], start=1
        ):
            staff, created = _get_or_create(
                db,
                DomesticStaff,
                community_id=c.id,
                phone=f"+9197{c.code[-2:]}00{i:04d}",
                defaults={
                    "full_name": name,
                    "staff_type": kind,
                    "police_verification_status": "verified",
                },
            )
            if created and unit is not None and i == 1:
                db.add(
                    StaffUnitAssignment(
                        community_id=c.id,
                        staff_id=staff.id,
                        unit_id=unit.id,
                        work_type="part_time",
                    )
                )


def seed_deliveries(db: Session, communities: list[Community]) -> None:
    from app.modules.deliveries.models import DeliveryProtocol

    presets = {
        "food": {"protocol_type": "collect_at_gate", "leave_at_gate": False},
        "ecommerce": {"protocol_type": "leave_at_gate", "leave_at_gate": True},
        "courier": {"protocol_type": "call_resident", "requires_otp": True},
    }
    for c in communities:
        for dtype, cfg in presets.items():
            _get_or_create(
                db,
                DeliveryProtocol,
                community_id=c.id,
                delivery_type=dtype,
                defaults=cfg,
            )


def seed_vehicles(db: Session, communities: list[Community]) -> None:
    from app.modules.communities.models import Tower
    from app.modules.residents.models import ResidentProfile
    from app.modules.vehicles.models import ParkingRule, ParkingSlot, Vehicle

    for c in communities:
        _get_or_create(db, ParkingRule, community_id=c.id, defaults={})
        tower = db.scalar(select(Tower).where(Tower.community_id == c.id).order_by(Tower.name))
        for n in range(1, 6):
            _get_or_create(
                db,
                ParkingSlot,
                community_id=c.id,
                slot_code=f"P-{n:02d}",
                defaults={
                    "slot_type": "car",
                    "tower_id": tower.id if tower else None,
                    "level": "B1",
                },
            )
        profile = db.scalar(select(ResidentProfile).where(ResidentProfile.community_id == c.id))
        if profile is not None:
            _get_or_create(
                db,
                Vehicle,
                community_id=c.id,
                registration_number=f"KA{c.code[-2:]}AB{c.code[-2:]}01",
                defaults={
                    "resident_profile_id": profile.id,
                    "vehicle_type": "car",
                    "make": "Maruti",
                },
            )


def seed_billing(db: Session, communities: list[Community]) -> None:
    from decimal import Decimal

    from app.modules.billing.models import BillingRule, ChargeHead

    heads = [
        ("MAINT", "Monthly Maintenance", "per_sqft", Decimal("2.50"), False),
        ("WATER", "Water Charges", "flat", Decimal("300.00"), False),
        ("SINK", "Sinking Fund", "flat", Decimal("500.00"), True),
    ]
    for c in communities:
        _get_or_create(
            db, BillingRule, community_id=c.id, defaults={"tax_percent": Decimal("18.00")}
        )
        for code, name, calc, amt, taxable in heads:
            _get_or_create(
                db,
                ChargeHead,
                community_id=c.id,
                code=code,
                defaults={
                    "name": name,
                    "calculation_type": calc,
                    "default_amount": amt,
                    "taxable": taxable,
                },
            )


def seed_complaints(db: Session, communities: list[Community]) -> None:
    from app.modules.complaints.models import ServiceCategory, SlaPolicy

    cats = [
        ("PLUMB", "Plumbing", "high"),
        ("ELEC", "Electrical", "high"),
        ("HOUSE", "Housekeeping", "low"),
        ("LIFT", "Lifts", "critical"),
    ]
    for c in communities:
        for code, name, prio in cats:
            cat, created = _get_or_create(
                db,
                ServiceCategory,
                community_id=c.id,
                code=code,
                defaults={"name": name, "default_priority": prio},
            )
            if created:
                db.add(
                    SlaPolicy(
                        community_id=c.id,
                        category_id=cat.id,
                        priority=prio,
                        response_minutes=60 if prio in ("high", "critical") else 240,
                        resolution_minutes=480 if prio == "critical" else 1440,
                        escalation_minutes=240 if prio == "critical" else 2880,
                    )
                )


def seed_amenities(db: Session, communities: list[Community]) -> None:
    from datetime import time

    from app.modules.amenities.models import Amenity, AmenityRule, AmenitySlot

    presets = [("CLUB", "Clubhouse", "clubhouse", 60), ("GYM", "Gym", "gym", 20)]
    for c in communities:
        for code, name, atype, cap in presets:
            am, created = _get_or_create(
                db,
                Amenity,
                community_id=c.id,
                code=code,
                defaults={"name": name, "amenity_type": atype, "capacity": cap},
            )
            if created:
                for dow in range(0, 7):
                    db.add(
                        AmenitySlot(
                            community_id=c.id,
                            amenity_id=am.id,
                            day_of_week=dow,
                            start_time=time(6, 0),
                            end_time=time(22, 0),
                            capacity=cap,
                        )
                    )
                db.add(
                    AmenityRule(
                        community_id=c.id,
                        amenity_id=am.id,
                        rule_type="max_advance_days",
                        rule_value={"value": 14},
                    )
                )
                db.add(
                    AmenityRule(
                        community_id=c.id,
                        amenity_id=am.id,
                        rule_type="max_active_per_unit",
                        rule_value={"value": 3},
                    )
                )


def seed_communication(db: Session, communities: list[Community]) -> None:
    from datetime import UTC, datetime

    from app.modules.communication.models import Announcement, AnnouncementTarget

    for c in communities:
        exists = db.scalar(
            select(Announcement).where(
                Announcement.community_id == c.id, Announcement.title == "Welcome to GateSphere"
            )
        )
        if exists is None:
            ann = Announcement(
                community_id=c.id,
                announcement_type="notice",
                title="Welcome to GateSphere",
                body="Your community portal is live. Raise tickets, book amenities, pay dues.",
                priority="normal",
                is_published=True,
                publish_at=datetime.now(UTC),
            )
            ann.targets.append(AnnouncementTarget(target_all_community=True))
            db.add(ann)


def seed_incidents(db: Session, communities: list[Community]) -> None:
    from app.modules.incidents.models import IncidentStatusHistory, SecurityIncident

    for c in communities:
        exists = db.scalar(
            select(SecurityIncident).where(
                SecurityIncident.community_id == c.id,
                SecurityIncident.incident_number == "INC-2026-00001",
            )
        )
        if exists is None:
            inc = SecurityIncident(
                community_id=c.id,
                incident_number="INC-2026-00001",
                incident_type="suspicious",
                severity="medium",
                status="resolved",
                location_text="Basement B1",
                description="Unattended bag reported; cleared by security.",
                resolution_summary="Bag belonged to a resident. No threat.",
            )
            db.add(inc)
            db.flush()
            db.add(
                IncidentStatusHistory(
                    community_id=c.id,
                    incident_id=inc.id,
                    old_status=None,
                    new_status="resolved",
                    reason="seed",
                )
            )


def seed_notifications(db: Session, communities: list[Community]) -> None:
    from app.modules.notifications.models import NotificationTemplate

    templates = [
        ("visitor_approved", "in_app", "Visitor approved", "{visitor} is approved for {unit}."),
        ("dues_reminder", "email", "Maintenance due", "Invoice {invoice} of {amount} is due."),
        ("incident_alert", "sms", "Security alert", "{severity} incident: {summary}"),
    ]
    for c in communities:
        for code, channel, title, body in templates:
            _get_or_create(
                db,
                NotificationTemplate,
                community_id=c.id,
                code=code,
                channel=channel,
                defaults={"title_template": title, "body_template": body},
            )


def seed_operations(db: Session, communities: list[Community]) -> None:
    """FR-17: realistic *operational* rows for every module so no screen renders empty.

    Idempotent — skips a community once it already has maintenance invoices.
    Rows are written directly (not through the service layer) to keep the seed
    deterministic and free of request/notification side effects.
    """
    from datetime import UTC, date, datetime, timedelta
    from decimal import Decimal

    from app.modules.amenities.models import Amenity, AmenityBooking
    from app.modules.billing.models import (
        ChargeHead,
        InvoiceItem,
        MaintenanceInvoice,
        Payment,
        PaymentAllocation,
    )
    from app.modules.communities.models import Gate
    from app.modules.complaints.models import (
        ServiceCategory,
        ServiceTicket,
        SlaPolicy,
        TicketStatusHistory,
    )
    from app.modules.deliveries.models import Delivery, DeliveryProtocol
    from app.modules.domestic_staff.models import DomesticStaff, StaffAttendance
    from app.modules.gate.models import PanicAlert
    from app.modules.residents.models import ResidentProfile, UnitOccupancy
    from app.modules.vehicles.models import ParkingAllocation, ParkingSlot, Vehicle, VehicleEntry
    from app.modules.visitors.models import Visitor, VisitorEntry, VisitorRequest

    now = datetime.now(UTC)
    guard = db.scalar(select(User).where(User.email == f"security_guard@{DEMO_DOMAIN}"))
    manager = db.scalar(select(User).where(User.email == f"facility_manager@{DEMO_DOMAIN}"))

    for c in communities:
        sfx = c.code[-2:]
        # Idempotency: keyed on this seed's own invoice-number prefix so a partially
        # populated dev DB still gets its operational rows filled in.
        if db.scalar(
            select(MaintenanceInvoice).where(
                MaintenanceInvoice.community_id == c.id,
                MaintenanceInvoice.invoice_number.like(f"INV-{sfx}-2026-%"),
            )
        ):
            continue

        occupancies = db.scalars(
            select(UnitOccupancy)
            .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
            .where(UnitOccupancy.community_id == c.id, UnitOccupancy.is_active.is_(True))
            .order_by(UnitOccupancy.created_at)
        ).all()
        if not occupancies:
            continue
        profiles = {
            p.id: p
            for p in db.scalars(
                select(ResidentProfile).where(ResidentProfile.community_id == c.id)
            ).all()
        }
        gate = db.scalar(select(Gate).where(Gate.community_id == c.id).order_by(Gate.code))

        def _resident_user(occ, _profiles=profiles):
            prof = _profiles.get(occ.resident_profile_id)
            return prof.user_id if prof else None

        # -- Billing: 3 invoices (paid / partially paid / posted-unpaid) + payments --------
        maint = db.scalar(
            select(ChargeHead).where(ChargeHead.community_id == c.id, ChargeHead.code == "MAINT")
        )
        water = db.scalar(
            select(ChargeHead).where(ChargeHead.community_id == c.id, ChargeHead.code == "WATER")
        )
        plans = [
            ("paid", Decimal("1")),
            ("partially_paid", Decimal("0.4")),
            ("posted", Decimal("0")),
        ]
        for idx, (target_status, paid_ratio) in enumerate(plans):
            occ = occupancies[idx % len(occupancies)]
            base = Decimal("2875.00")
            water_amt = Decimal("300.00")
            tax = ((base + water_amt) * Decimal("0.18")).quantize(Decimal("0.01"))
            total = base + water_amt + tax
            paid = (total * paid_ratio).quantize(Decimal("0.01"))
            inv = MaintenanceInvoice(
                community_id=c.id,
                unit_id=occ.unit_id,
                billed_to_user_id=_resident_user(occ),
                invoice_number=f"INV-{sfx}-2026-{idx + 1:04d}",
                billing_period_start=date(2026, 8, 1),
                billing_period_end=date(2026, 8, 31),
                issue_date=date(2026, 8, 1),
                due_date=date(2026, 8, 15),
                subtotal=base + water_amt,
                tax=tax,
                total_amount=total,
                amount_paid=paid,
                balance_due=total - paid,
                status=target_status,
            )
            inv.items = [
                InvoiceItem(
                    charge_head_id=maint.id if maint else None,
                    description="Monthly Maintenance",
                    quantity=Decimal("1150"),
                    unit_rate=Decimal("2.50"),
                    amount=base,
                    taxable=True,
                ),
                InvoiceItem(
                    charge_head_id=water.id if water else None,
                    description="Water Charges",
                    quantity=Decimal("1"),
                    unit_rate=water_amt,
                    amount=water_amt,
                    taxable=True,
                ),
            ]
            db.add(inv)
            db.flush()
            if paid > 0:
                pay = Payment(
                    community_id=c.id,
                    payer_user_id=_resident_user(occ),
                    payment_reference=f"PAY-{sfx}-2026-{idx + 1:04d}",
                    receipt_number=f"RCP-{sfx}-2026-{idx + 1:06d}",
                    receipt_issued_at=now,
                    amount=paid,
                    payment_method="upi",
                    payment_status="success",
                    gateway_name="razorpay",
                    gateway_transaction_id=f"rzp_{sfx}{idx + 1:06d}",
                )
                pay.allocations = [PaymentAllocation(invoice_id=inv.id, allocated_amount=paid)]
                db.add(pay)

        # -- Complaints: 3 tickets across the lifecycle -----------------------------------
        cats = db.scalars(
            select(ServiceCategory)
            .where(ServiceCategory.community_id == c.id)
            .order_by(ServiceCategory.code)
        ).all()
        slas = {
            s.category_id: s
            for s in db.scalars(select(SlaPolicy).where(SlaPolicy.community_id == c.id)).all()
        }
        ticket_plan = [
            ("created", "Kitchen tap leaking", None),
            ("in_progress", "Bedroom power socket sparking", None),
            ("resolved", "Corridor light not working", now - timedelta(hours=6)),
        ]
        for idx, (status, subject, resolved_at) in enumerate(ticket_plan):
            occ = occupancies[idx % len(occupancies)]
            cat = cats[idx % len(cats)] if cats else None
            sla = slas.get(cat.id) if cat else None
            t = ServiceTicket(
                community_id=c.id,
                unit_id=occ.unit_id,
                ticket_number=f"TKT-{sfx}-2026-{idx + 1:04d}",
                raised_by_user_id=_resident_user(occ),
                category_id=cat.id if cat else None,
                sla_policy_id=sla.id if sla else None,
                subject=subject,
                description=f"{subject}. Reported by resident; please attend.",
                priority=cat.default_priority if cat else "medium",
                status=status,
                first_response_due_at=now + timedelta(minutes=60),
                resolution_due_at=now + timedelta(hours=24),
                escalation_due_at=now + timedelta(hours=4),
                resolved_at=resolved_at,
            )
            db.add(t)
            db.flush()
            chain = {
                "created": ["created"],
                "in_progress": ["created", "assigned", "in_progress"],
                "resolved": ["created", "assigned", "in_progress", "resolved"],
            }[status]
            prev = None
            for st in chain:
                db.add(
                    TicketStatusHistory(
                        ticket_id=t.id, from_status=prev, to_status=st, remarks="seed"
                    )
                )
                prev = st

        # -- Amenities: 2 upcoming confirmed bookings -------------------------------------
        for idx, amen in enumerate(
            db.scalars(
                select(Amenity).where(Amenity.community_id == c.id).order_by(Amenity.code)
            ).all()
        ):
            occ = occupancies[idx % len(occupancies)]
            day = (now + timedelta(days=idx + 1)).date()
            start = datetime.combine(day, datetime.min.time(), tzinfo=UTC).replace(hour=18)
            db.add(
                AmenityBooking(
                    community_id=c.id,
                    amenity_id=amen.id,
                    unit_id=occ.unit_id,
                    resident_user_id=_resident_user(occ),
                    booking_date=day,
                    start_at=start,
                    end_at=start + timedelta(hours=1),
                    participant_count=4,
                    status="confirmed",
                )
            )

        # -- Deliveries: expected / at_gate / delivered --------------------------------
        protos = {
            p.delivery_type: p
            for p in db.scalars(
                select(DeliveryProtocol).where(DeliveryProtocol.community_id == c.id)
            ).all()
        }
        deliv_plan = [
            ("food", "Swiggy", "expected", "pending"),
            ("ecommerce", "Amazon", "at_gate", "approved"),
            ("courier", "Blue Dart", "delivered", "approved"),
        ]
        for idx, (dtype, provider, status, approval) in enumerate(deliv_plan):
            occ = occupancies[idx % len(occupancies)]
            proto = protos.get(dtype)
            db.add(
                Delivery(
                    community_id=c.id,
                    unit_id=occ.unit_id,
                    resident_user_id=_resident_user(occ),
                    protocol_id=proto.id if proto else None,
                    delivery_type=dtype,
                    provider_name=provider,
                    executive_name=f"{provider} Rider",
                    executive_phone=f"+9199{sfx}00{idx + 1:04d}",
                    tracking_reference=f"{provider[:3].upper()}{sfx}{idx + 1:08d}",
                    approval_status=approval,
                    approved_by_user_id=guard.id if approval == "approved" and guard else None,
                    expected_at=now + timedelta(hours=1),
                    arrived_at=now - timedelta(minutes=20) if status != "expected" else None,
                    status=status,
                )
            )

        # -- Visitors: one guest inside, one completed visit ----------------------------
        visitors = db.scalars(
            select(Visitor).where(Visitor.community_id == c.id).order_by(Visitor.phone)
        ).all()
        for idx, vstatus in enumerate(("entered", "completed")):
            if idx >= len(visitors):
                break
            occ = occupancies[idx % len(occupancies)]
            v = visitors[idx]
            req = VisitorRequest(
                community_id=c.id,
                visitor_id=v.id,
                unit_id=occ.unit_id,
                host_user_id=_resident_user(occ),
                created_by_user_id=_resident_user(occ),
                visitor_type="guest",
                purpose="Family visit",
                expected_at=now - timedelta(hours=2),
                valid_until=now + timedelta(hours=6),
                status=vstatus,
                approval_required=True,
                party_size=1,
            )
            db.add(req)
            db.flush()
            db.add(
                VisitorEntry(
                    community_id=c.id,
                    request_id=req.id,
                    visitor_id=v.id,
                    gate_id=gate.id if gate else None,
                    entry_guard_user_id=guard.id if guard else None,
                    exit_guard_user_id=guard.id if (guard and vstatus == "completed") else None,
                    entry_at=now - timedelta(hours=2),
                    exit_at=now - timedelta(minutes=30) if vstatus == "completed" else None,
                    status="inside" if vstatus == "entered" else "exited",
                )
            )

        # -- Vehicles: active allocation + gate movements ------------------------------
        veh = db.scalar(select(Vehicle).where(Vehicle.community_id == c.id))
        slot = db.scalar(
            select(ParkingSlot)
            .where(ParkingSlot.community_id == c.id)
            .order_by(ParkingSlot.slot_code)
        )
        if veh and slot:
            db.add(
                ParkingAllocation(
                    community_id=c.id,
                    slot_id=slot.id,
                    vehicle_id=veh.id,
                    unit_id=occupancies[0].unit_id,
                    status="active",
                    allocated_by_user_id=manager.id if manager else None,
                )
            )
            db.add(
                VehicleEntry(
                    community_id=c.id,
                    vehicle_id=veh.id,
                    registration_number=veh.registration_number,
                    gate_id=gate.id if gate else None,
                    entry_guard_user_id=guard.id if guard else None,
                    source_type="resident",
                    status="inside",
                )
            )
        db.add(
            VehicleEntry(
                community_id=c.id,
                registration_number=f"KA{sfx}XY{sfx}99",
                gate_id=gate.id if gate else None,
                entry_guard_user_id=guard.id if guard else None,
                exit_guard_user_id=guard.id if guard else None,
                entry_at=now - timedelta(hours=3),
                exit_at=now - timedelta(hours=1),
                source_type="visitor",
                status="exited",
            )
        )

        # -- Domestic staff: one on-site, one checked-out ------------------------------
        staff = db.scalars(
            select(DomesticStaff)
            .where(DomesticStaff.community_id == c.id)
            .order_by(DomesticStaff.phone)
        ).all()
        for idx, s in enumerate(staff[:2]):
            db.add(
                StaffAttendance(
                    community_id=c.id,
                    staff_id=s.id,
                    gate_id=gate.id if gate else None,
                    check_in_at=now - timedelta(hours=4 + idx),
                    check_out_at=None if idx == 0 else now - timedelta(hours=1),
                    check_in_by_user_id=guard.id if guard else None,
                    check_out_by_user_id=guard.id if (guard and idx == 1) else None,
                    attendance_status="inside" if idx == 0 else "left",
                )
            )

        # -- Gate: a resolved panic alert -------------------------------------------------
        db.add(
            PanicAlert(
                community_id=c.id,
                triggered_by_user_id=_resident_user(occupancies[0]),
                gate_id=gate.id if gate else None,
                alert_type="medical",
                severity="high",
                message="Resident reported a medical emergency in the lobby.",
                status="resolved",
                triggered_at=now - timedelta(days=1),
                acknowledged_by_user_id=guard.id if guard else None,
                acknowledged_at=now - timedelta(days=1) + timedelta(minutes=2),
                resolved_at=now - timedelta(days=1) + timedelta(minutes=40),
                resolution_summary="Ambulance called; resident stabilised and taken to hospital.",
            )
        )


def seed_audit_trail(db: Session, communities: list[Community]) -> None:
    """FR-17: a populated audit trail so `/audit/logs` is never empty on a fresh demo.

    Written directly (append-only; the immutability trigger blocks later edits). Idempotent —
    skips once any `login.success` row exists.
    """
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import func as _f

    from app.modules.audit.models import AuditLog
    from app.modules.billing.models import MaintenanceInvoice
    from app.modules.complaints.models import ServiceTicket
    from app.modules.users.models import Role, User, UserRole
    from app.modules.visitors.models import VisitorRequest

    if db.scalar(
        select(_f.count()).select_from(AuditLog).where(AuditLog.action == "login.success")
    ):
        return

    now = datetime.now(UTC)
    rows: list[AuditLog] = []
    for c in communities:
        ca = db.scalar(
            select(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.slug == "community_admin", UserRole.community_id == c.id)
        ) or db.scalar(select(User).where(User.email == f"community_admin@{DEMO_DOMAIN}"))
        rows.append(
            AuditLog(
                community_id=c.id,
                user_id=ca.id if ca else None,
                role_slug="community_admin",
                module="auth",
                action="login.success",
                entity_type="user",
                entity_id=str(ca.id) if ca else None,
                new_values={"role": "community_admin"},
                ip_address="203.0.113.10",
                created_at=now - timedelta(days=2),
            )
        )
        inv = db.scalar(
            select(MaintenanceInvoice).where(MaintenanceInvoice.community_id == c.id).limit(1)
        )
        if inv:
            rows.append(
                AuditLog(
                    community_id=c.id,
                    user_id=ca.id if ca else None,
                    role_slug="community_admin",
                    module="billing",
                    action="invoice.post",
                    entity_type="maintenance_invoice",
                    entity_id=str(inv.id),
                    old_values={"status": "draft"},
                    new_values={"status": "posted"},
                    ip_address="203.0.113.10",
                    created_at=now - timedelta(days=1, hours=3),
                )
            )
        tk = db.scalar(select(ServiceTicket).where(ServiceTicket.community_id == c.id).limit(1))
        if tk:
            rows.append(
                AuditLog(
                    community_id=c.id,
                    user_id=ca.id if ca else None,
                    role_slug="facility_manager",
                    module="complaints",
                    action="ticket.in_progress",
                    entity_type="service_ticket",
                    entity_id=str(tk.id),
                    old_values={"status": "assigned"},
                    new_values={"status": "in_progress"},
                    ip_address="203.0.113.22",
                    created_at=now - timedelta(hours=20),
                )
            )
        vr = db.scalar(select(VisitorRequest).where(VisitorRequest.community_id == c.id).limit(1))
        if vr:
            rows.append(
                AuditLog(
                    community_id=c.id,
                    user_id=ca.id if ca else None,
                    role_slug="resident",
                    module="visitors",
                    action="request.approved",
                    entity_type="visitor_request",
                    entity_id=str(vr.id),
                    new_values={"decision": "approved"},
                    ip_address="203.0.113.44",
                    created_at=now - timedelta(hours=6),
                )
            )
    db.add_all(rows)
    db.flush()
    log.info("seed.audit_trail", rows=len(rows))


def reset_data(db: Session) -> None:
    """TRUNCATE every data table (schema + `alembic_version` kept) so `main()` re-seeds
    from a guaranteed-clean state. `CASCADE` handles FK order; `RESTART IDENTITY` resets
    the few `Identity` sequences (e.g. `ledger_entries.entry_seq`)."""
    import app.db.base  # noqa: F401 — register every model on Base.metadata
    from app.db.base_class import Base

    names = [t.name for t in Base.metadata.sorted_tables if t.name != "alembic_version"]
    if names:
        cols = ", ".join(f'"{n}"' for n in names)
        db.execute(text(f"TRUNCATE {cols} RESTART IDENTITY CASCADE"))
        db.commit()
    log.info("seed.reset", tables=len(names))


def main(*, reset: bool = False) -> None:
    with SessionLocal() as db:
        if reset:
            reset_data(db)
        seed_rbac(db)
        communities = seed_property(db)
        seed_users(db, communities)
        seed_residents(db, communities)
        seed_visitors(db, communities)
        seed_gate(db, communities)
        seed_domestic_staff(db, communities)
        seed_deliveries(db, communities)
        seed_vehicles(db, communities)
        seed_complaints(db, communities)
        seed_billing(db, communities)
        seed_amenities(db, communities)
        seed_communication(db, communities)
        seed_incidents(db, communities)
        seed_notifications(db, communities)
        seed_operations(db, communities)
        seed_audit_trail(db, communities)
        db.commit()
    log.info("seed.done")
    print(f"Seed complete. Demo users: <role>@{DEMO_DOMAIN} / <role>{DEMO_PASSWORD_SUFFIX}")
    print("e.g.  super_admin@gatesphere.com / super_admin@Gate2026!")


if __name__ == "__main__":
    main(reset="--reset" in sys.argv[1:])

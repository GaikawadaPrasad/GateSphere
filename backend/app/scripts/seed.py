"""Idempotent synthetic seed data.

Run: `python -m app.scripts.seed`  (or `make seed`).

Per the PRD: empty screens are prohibited. This seeds RBAC + 2 communities, 4 towers,
8 floors, 50+ units, plus a demo user per role. Extend module-by-module as models land.
"""

from __future__ import annotations

import structlog
from sqlalchemy import select
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


def main() -> None:
    with SessionLocal() as db:
        seed_rbac(db)
        communities = seed_property(db)
        seed_users(db, communities)
        seed_residents(db, communities)
        seed_visitors(db, communities)
        seed_gate(db, communities)
        seed_domestic_staff(db, communities)
        seed_deliveries(db, communities)
        db.commit()
    log.info("seed.done")
    print(f"Seed complete. Demo users: <role>@{DEMO_DOMAIN} / <role>{DEMO_PASSWORD_SUFFIX}")
    print("e.g.  super_admin@gatesphere.com / super_admin@Gate2026!")


if __name__ == "__main__":
    main()

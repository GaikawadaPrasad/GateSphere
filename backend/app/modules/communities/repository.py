"""Data-access for Community & Property (FR-03). Queries only — no business rules.

Async stack (ADR-010).
"""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import Select, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import TenantScope
from app.db.repository import AsyncTenantRepository
from app.modules.communities.models import Community, Floor, Gate, Tower, Unit

log = structlog.get_logger(__name__)


class CommunityRepository:
    """`communities` is the tenant root — filter on `id`, not `community_id`."""

    def __init__(self, db: AsyncSession, scope: TenantScope) -> None:
        self.db = db
        self.scope = scope

    def _scoped(self, stmt: Select) -> Select:
        if self.scope.is_global:
            return stmt
        return stmt.where(Community.id.in_(self.scope.community_ids))

    async def _populate_admin_info(self, comms: list[Community]) -> list[Community]:
        if not comms:
            return comms
        for c in comms:
            if not hasattr(c, "admin_email"):
                c.admin_email = None
            if not hasattr(c, "admin_name"):
                c.admin_name = None
        from app.modules.users.models import Role, User, UserRole

        comm_map = {c.id: c for c in comms}
        stmt = (
            select(UserRole.community_id, User.email, User.full_name)
            .join(User, User.id == UserRole.user_id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                Role.slug == "community_admin",
                UserRole.community_id.in_(list(comm_map.keys())),
            )
        )
        try:
            res = await self.db.execute(stmt)
            for community_id, email, full_name in res.all():
                if community_id in comm_map:
                    comm_map[community_id].admin_email = email
                    comm_map[community_id].admin_name = full_name
        except SQLAlchemyError as exc:
            # Admin name/email are display-only enrichment; the list itself must still load.
            log.warning("communities.admin_info_failed", error=type(exc).__name__)
        return comms

    async def get(self, community_id: uuid.UUID) -> Community | None:
        comm = await self.db.scalar(
            self._scoped(select(Community).where(Community.id == community_id))
        )
        if comm:
            await self._populate_admin_info([comm])
        return comm

    async def get_by_code(self, code: str) -> Community | None:
        comm = await self.db.scalar(select(Community).where(Community.code == code.lower()))
        if comm:
            await self._populate_admin_info([comm])
        return comm

    async def list(self, *, offset: int, limit: int, active: bool | None = None) -> list[Community]:
        stmt = select(Community)
        if active is not None:
            stmt = stmt.where(Community.is_active.is_(active))
        stmt = self._scoped(stmt).order_by(Community.name).offset(offset).limit(limit)
        comms = list((await self.db.scalars(stmt)).all())
        await self._populate_admin_info(comms)
        return comms

    async def count(self, *, active: bool | None = None) -> int:
        stmt = select(func.count()).select_from(Community)
        if active is not None:
            stmt = stmt.where(Community.is_active.is_(active))
        return int(await self.db.scalar(self._scoped(stmt)) or 0)

    async def add(self, obj: Community) -> Community:
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def provision_community_admin(
        self,
        community_id: uuid.UUID,
        *,
        email: str,
        password_hash: str,
        full_name: str,
        phone: str | None = None,
    ):
        from app.modules.users.models import Role, User, UserRole

        clean_email = email.strip().lower()
        user = await self.db.scalar(select(User).where(User.email == clean_email))
        clean_phone = phone.strip()[:20] if phone and phone.strip() else None
        if clean_phone:
            phone_user = await self.db.scalar(select(User).where(User.phone == clean_phone))
            if phone_user is not None and (user is None or phone_user.id != user.id):
                from app.core.errors import ConflictError

                raise ConflictError(
                    "Phone number is already associated with another account",
                    code="PHONE_TAKEN",
                    fields={"admin_phone": "taken"},
                )

        if user is None:
            user = User(
                email=clean_email,
                full_name=full_name.strip(),
                phone=clean_phone,
                password_hash=password_hash,
                is_active=True,
            )
            self.db.add(user)
            await self.db.flush()
        else:
            if not user.phone and clean_phone:
                user.phone = clean_phone
            user.is_active = True
            await self.db.flush()

        role = await self.db.scalar(select(Role).where(Role.slug == "community_admin"))
        if role is not None:
            existing_role = await self.db.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id,
                    UserRole.role_id == role.id,
                    UserRole.community_id == community_id,
                )
            )
            if existing_role is None:
                ur = UserRole(user_id=user.id, role_id=role.id, community_id=community_id)
                self.db.add(ur)
                await self.db.flush()

        return user


async def gate_in_scope(db: AsyncSession, scope: TenantScope, gate_id: uuid.UUID) -> Gate | None:
    """A gate by id, only if it lies inside `scope` (None otherwise). Shared by the gate,
    vehicles and deliveries services, which each validate a client-supplied `gate_id`."""
    stmt = select(Gate).where(Gate.id == gate_id)
    if not scope.is_global:
        stmt = stmt.where(Gate.community_id.in_(scope.community_ids))
    return await db.scalar(stmt)


class GateRepository(AsyncTenantRepository[Gate]):
    model = Gate

    async def by_code(self, community_id: uuid.UUID, code: str) -> Gate | None:
        return await self.db.scalar(
            select(Gate).where(Gate.community_id == community_id, Gate.code == code)
        )

    async def list_for_community(
        self, community_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Gate], int]:
        stmt = select(Gate).where(Gate.community_id == community_id).order_by(Gate.code)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )


class TowerRepository(AsyncTenantRepository[Tower]):
    model = Tower

    async def by_name(self, community_id: uuid.UUID, name: str) -> Tower | None:
        return await self.db.scalar(
            select(Tower).where(Tower.community_id == community_id, Tower.name == name)
        )

    async def by_code(self, community_id: uuid.UUID, code: str) -> Tower | None:
        return await self.db.scalar(
            select(Tower).where(Tower.community_id == community_id, Tower.code == code)
        )

    async def list_for_community(
        self, community_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Tower], int]:
        stmt = select(Tower).where(Tower.community_id == community_id).order_by(Tower.name)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )


class FloorRepository(AsyncTenantRepository[Floor]):
    model = Floor

    async def list_for_tower(
        self, tower_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Floor], int]:
        stmt = select(Floor).where(Floor.tower_id == tower_id).order_by(Floor.floor_number)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )

    async def by_number(
        self, *, community_id: uuid.UUID, tower_id: uuid.UUID, number: int
    ) -> Floor | None:
        return await self.db.scalar(
            select(Floor).where(
                Floor.community_id == community_id,
                Floor.tower_id == tower_id,
                Floor.floor_number == number,
            )
        )


class UnitRepository(AsyncTenantRepository[Unit]):
    model = Unit

    async def list_for_floor(
        self, floor_id: uuid.UUID, *, offset: int, limit: int
    ) -> tuple[list[Unit], int]:
        stmt = select(Unit).where(Unit.floor_id == floor_id).order_by(Unit.unit_number)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )

    async def list_for_community(
        self,
        community_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
        tower_id: uuid.UUID | None = None,
        floor_id: uuid.UUID | None = None,
        unit_type: str | None = None,
        active: bool | None = None,
    ) -> tuple[list[Unit], int]:
        stmt = select(Unit).where(Unit.community_id == community_id)
        if tower_id is not None:
            stmt = stmt.where(Unit.tower_id == tower_id)
        if floor_id is not None:
            stmt = stmt.where(Unit.floor_id == floor_id)
        if unit_type is not None:
            stmt = stmt.where(Unit.unit_type == unit_type)
        if active is not None:
            stmt = stmt.where(Unit.is_active.is_(active))
        stmt = stmt.order_by(Unit.unit_number)
        return (
            await self.list(offset=offset, limit=limit, extra=stmt),
            await self.count(extra=stmt),
        )

    async def by_number(
        self, *, community_id: uuid.UUID, tower_id: uuid.UUID, number: str
    ) -> Unit | None:
        return await self.db.scalar(
            select(Unit).where(
                Unit.community_id == community_id,
                Unit.tower_id == tower_id,
                Unit.unit_number == number,
            )
        )

    async def counts_by_floors(self, floor_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not floor_ids:
            return {}
        stmt = (
            select(Unit.floor_id, func.count(Unit.id))
            .where(Unit.floor_id.in_(floor_ids))
            .group_by(Unit.floor_id)
        )
        rows = await self.db.execute(stmt)
        return {r[0]: int(r[1]) for r in rows.all()}

    async def counts_by_towers(self, tower_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not tower_ids:
            return {}
        stmt = (
            select(Unit.tower_id, func.count(Unit.id))
            .where(Unit.tower_id.in_(tower_ids))
            .group_by(Unit.tower_id)
        )
        rows = await self.db.execute(stmt)
        return {r[0]: int(r[1]) for r in rows.all()}

"""Row-level (own-unit) access scoping for resident-facing modules (FR-04, FR-09, FR-10).

`TenantScope` isolates by **community**; this adds the finer cut the PRD/SRS RBAC matrix
implies for *Owner / Tenant — Residential unit control*: a user whose role in the community
is only `resident` may see and act on records for the **units they occupy**, not every unit
in the community.

`actor_unit_scope(db, actor)` returns:
- `None`  -> unrestricted. The actor is a platform admin, or holds a management / security /
  audit / vendor role somewhere, so acting across units is part of their job.
- `frozenset[unit_id]` -> the units the actor currently, actively occupies (possibly empty).

Services mix in `UnitScopedAccess` and call `_assert_unit_visible(...)` on the state-changing
paths and `_scope_unit_column(...)` / `_scope_owned(...)` on the list queries.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, false, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import NotFoundError
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import Role, User, UserRole

# Holding any of these (community-scoped or global) means "acts across units by design".
CROSS_UNIT_ROLES = frozenset(
    {
        "super_admin",
        "community_admin",
        "association_committee",
        "facility_manager",
        "security_supervisor",
        "security_guard",
        "auditor",
        "vendor_technician",
    }
)

_MISSING = object()


async def actor_unit_scope(db: AsyncSession, actor: User) -> frozenset[uuid.UUID] | None:
    if actor.is_superadmin:
        return None
    cross = await db.scalar(
        select(UserRole.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id == actor.id, Role.slug.in_(CROSS_UNIT_ROLES))
        .limit(1)
    )
    if cross is not None:
        return None
    rows = await db.scalars(
        select(UnitOccupancy.unit_id)
        .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
        .where(
            ResidentProfile.user_id == actor.id,
            UnitOccupancy.is_active.is_(True),
        )
    )
    return frozenset(rows.all())


class UnitScopedAccess:
    """Mixin for a service exposing `self.db` (AsyncSession) and `self.actor` (User)."""

    db: AsyncSession
    actor: User

    async def _unit_scope(self) -> frozenset[uuid.UUID] | None:
        cached = getattr(self, "_unit_scope_val", _MISSING)
        if cached is _MISSING:
            cached = await actor_unit_scope(self.db, self.actor)
            self._unit_scope_val = cached
        return cached

    async def is_unit_restricted(self) -> bool:
        return (await self._unit_scope()) is not None

    async def _assert_unit_visible(self, unit_id: uuid.UUID | None) -> None:
        scope = await self._unit_scope()
        if scope is not None and unit_id not in scope:
            # Same shape as a real 404 — never reveal that the record exists in the community.
            raise NotFoundError("Not found")

    async def _scope_unit_column(
        self,
        stmt: Select,
        unit_col: ColumnElement,
        *,
        or_owned: ColumnElement | None = None,
    ) -> Select:
        """Narrow a list query to the actor's units (optionally OR a `created_by == me`
        style column). No-op for an unrestricted actor."""
        scope = await self._unit_scope()
        if scope is None:
            return stmt
        if not scope:
            return stmt.where(or_owned) if or_owned is not None else stmt.where(false())
        cond: ColumnElement = unit_col.in_(scope)
        if or_owned is not None:
            cond = cond | or_owned
        return stmt.where(cond)

    async def _scope_owned(self, stmt: Select, owner_col: ColumnElement) -> Select:
        """Narrow a list query to rows the actor owns (by user id). No-op if unrestricted."""
        scope = await self._unit_scope()
        if scope is None:
            return stmt
        return stmt.where(owner_col == self.actor.id)

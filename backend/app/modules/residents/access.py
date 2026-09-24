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

`user_in_community(db, user_id, community_id)` is the related check for a user id that arrives
in a **payload** (incident responder, ticket assignee, resident-group member) — one community
must not be able to reference another community's users.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Select, false, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import QueryableAttribute
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

# A mapped column (`Model.col`, an InstrumentedAttribute) or any column expression.
_Column = ColumnElement[Any] | QueryableAttribute[Any]


async def user_in_community(db: AsyncSession, user_id: uuid.UUID, community_id: uuid.UUID) -> bool:
    """True if `user_id` is a member of `community_id` — holds a community-scoped role grant
    there, or has a resident profile there. A platform-global grant (super_admin / auditor)
    does **not** count as membership. Use to validate a user id that arrives in a payload
    (incident responder, ticket assignee, group member) so one community can't reference
    another's users."""
    if await db.scalar(
        select(UserRole.id)
        .where(UserRole.user_id == user_id, UserRole.community_id == community_id)
        .limit(1)
    ):
        return True
    return bool(
        await db.scalar(
            select(ResidentProfile.id)
            .where(
                ResidentProfile.user_id == user_id,
                ResidentProfile.community_id == community_id,
            )
            .limit(1)
        )
    )


async def actor_unit_scope(
    db: AsyncSession, actor: User, community_id: uuid.UUID | None = None
) -> frozenset[uuid.UUID] | None:
    if actor.is_superadmin:
        return None

    role_filter = [UserRole.user_id == actor.id, Role.slug.in_(CROSS_UNIT_ROLES)]
    if community_id is not None:
        role_filter.append(
            (UserRole.community_id == community_id) | (UserRole.community_id.is_(None))
        )

    cross = await db.scalar(
        select(UserRole.id).join(Role, Role.id == UserRole.role_id).where(*role_filter).limit(1)
    )
    if cross is not None:
        return None

    occ_filter = [
        ResidentProfile.user_id == actor.id,
        UnitOccupancy.is_active.is_(True),
    ]
    if community_id is not None:
        occ_filter.append(ResidentProfile.community_id == community_id)

    rows = await db.scalars(
        select(UnitOccupancy.unit_id)
        .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
        .where(*occ_filter)
    )
    return frozenset(rows.all())


class UnitScopedAccess:
    """Mixin for a service exposing `self.db` (AsyncSession) and `self.actor` (User)."""

    db: AsyncSession
    actor: User

    async def _unit_scope(
        self, community_id: uuid.UUID | None = None
    ) -> frozenset[uuid.UUID] | None:
        cid = community_id
        if cid is None:
            scope = getattr(self, "scope", None)
            if scope and hasattr(scope, "community_ids") and len(scope.community_ids) == 1:
                cid = next(iter(scope.community_ids))
            elif hasattr(self, "community_id"):
                cid = self.community_id

        cache_key = f"_unit_scope_val_{cid}"
        cached = getattr(self, cache_key, _MISSING)
        if cached is _MISSING:
            cached = await actor_unit_scope(self.db, self.actor, community_id=cid)
            setattr(self, cache_key, cached)
        return cached

    async def is_unit_restricted(self, community_id: uuid.UUID | None = None) -> bool:
        return (await self._unit_scope(community_id)) is not None

    async def _assert_unit_visible(
        self, unit_id: uuid.UUID | None, community_id: uuid.UUID | None = None
    ) -> None:
        scope = await self._unit_scope(community_id)
        if scope is not None and unit_id not in scope:
            # Same shape as a real 404 — never reveal that the record exists in the community.
            raise NotFoundError("Not found")

    async def _scope_unit_column(
        self,
        stmt: Select,
        unit_col: _Column,
        *,
        or_owned: _Column | None = None,
        community_id: uuid.UUID | None = None,
    ) -> Select:
        """Narrow a list query to the actor's units (optionally OR a `created_by == me`
        style column). No-op for an unrestricted actor."""
        scope = await self._unit_scope(community_id)
        if scope is None:
            return stmt
        if not scope:
            return stmt.where(or_owned) if or_owned is not None else stmt.where(false())
        cond: ColumnElement = unit_col.in_(scope)
        if or_owned is not None:
            cond = cond | or_owned
        return stmt.where(cond)

    async def _scope_owned(
        self,
        stmt: Select,
        owner_col: _Column,
        community_id: uuid.UUID | None = None,
    ) -> Select:
        """Narrow a list query to rows the actor owns (by user id). No-op if unrestricted."""
        scope = await self._unit_scope(community_id)
        if scope is None:
            return stmt
        return stmt.where(owner_col == self.actor.id)

"""Multi-tenant scope resolution (AGENTS.md §3).

`get_tenant_scope` resolves the set of community ids the caller may touch, from their
role grants — **never** from a client-supplied value. Community-scoped modules inject it
and pass it to every repository call; the repository applies it before query execution.

Super Admin / Auditor resolve to ALL communities; a `X-Community-Id` header lets Super
Admin narrow the active community for a request.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.errors import ForbiddenError
from app.core.security import require_auth, require_auth_async
from app.db.session import get_async_db, get_db
from app.modules.users.models import User, UserRole


@dataclass(frozen=True)
class TenantScope:
    user_id: uuid.UUID
    is_global: bool
    community_ids: frozenset[uuid.UUID]  # empty + is_global => all communities

    def allows(self, community_id: uuid.UUID | None) -> bool:
        if self.is_global:
            return True
        return community_id is not None and community_id in self.community_ids

    def require(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is None or not self.allows(community_id):
            # Cross-tenant access is a 404, never a 403 (enumeration oracle).
            from app.core.errors import NotFoundError

            raise NotFoundError("Resource not found")
        return community_id


def bind_rls_scope(db: Session, scope: TenantScope) -> None:
    """Set the request-scoped GUC the RLS policies read (migration 0003).

    No-op for a global scope. Safe to call once per request after the scope is known.
    """
    from sqlalchemy import text

    value = "" if scope.is_global else ",".join(str(c) for c in scope.community_ids)
    db.execute(text("SELECT set_config('app.community_ids', :v, true)"), {"v": value})


def get_tenant_scope(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
    x_community_id: str | None = Header(default=None, alias="X-Community-Id"),
) -> TenantScope:
    if user.is_superadmin:
        active: frozenset[uuid.UUID] = frozenset()
        if x_community_id:
            try:
                active = frozenset({uuid.UUID(x_community_id)})
            except ValueError as exc:
                raise ForbiddenError("Invalid X-Community-Id", code="INVALID_SCOPE") from exc
            return TenantScope(user.id, is_global=False, community_ids=active)
        return TenantScope(user.id, is_global=True, community_ids=active)

    rows = db.scalars(select(UserRole.community_id).where(UserRole.user_id == user.id)).all()
    community_ids = frozenset(cid for cid in rows if cid is not None)
    is_global = any(cid is None for cid in rows)  # e.g. a global Auditor grant

    if x_community_id:
        try:
            wanted = uuid.UUID(x_community_id)
        except ValueError as exc:
            raise ForbiddenError("Invalid X-Community-Id", code="INVALID_SCOPE") from exc
        if not is_global and wanted not in community_ids:
            raise ForbiddenError("Not a member of that community", code="INVALID_SCOPE")
        return TenantScope(user.id, is_global=False, community_ids=frozenset({wanted}))

    request.state.tenant_scope = TenantScope(user.id, is_global, community_ids)
    return request.state.tenant_scope


@dataclass
class TenantContext:
    db: Session
    scope: TenantScope


def tenant_context(
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
) -> TenantContext:
    """Combined dependency for community-scoped module routers.

    Usage:
        @router.get("/visitors")
        def list_visitors(ctx: TenantContext = Depends(tenant_context)):
            repo = VisitorRepository(ctx.db, ctx.scope)
            ...
    """
    bind_rls_scope(db, scope)
    return TenantContext(db=db, scope=scope)


# --------------------------------------------------------------------------- #
# Async twins (ADR-010).
# --------------------------------------------------------------------------- #
async def bind_rls_scope_async(db: AsyncSession, scope: TenantScope) -> None:
    from sqlalchemy import text

    value = "" if scope.is_global else ",".join(str(c) for c in scope.community_ids)
    await db.execute(text("SELECT set_config('app.community_ids', :v, true)"), {"v": value})


async def get_tenant_scope_async(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(require_auth_async),
    x_community_id: str | None = Header(default=None, alias="X-Community-Id"),
) -> TenantScope:
    if user.is_superadmin:
        if x_community_id:
            try:
                active = frozenset({uuid.UUID(x_community_id)})
            except ValueError as exc:
                raise ForbiddenError("Invalid X-Community-Id", code="INVALID_SCOPE") from exc
            return TenantScope(user.id, is_global=False, community_ids=active)
        return TenantScope(user.id, is_global=True, community_ids=frozenset())

    rows = (
        await db.scalars(select(UserRole.community_id).where(UserRole.user_id == user.id))
    ).all()
    community_ids = frozenset(cid for cid in rows if cid is not None)
    is_global = any(cid is None for cid in rows)

    if x_community_id:
        try:
            wanted = uuid.UUID(x_community_id)
        except ValueError as exc:
            raise ForbiddenError("Invalid X-Community-Id", code="INVALID_SCOPE") from exc
        if not is_global and wanted not in community_ids:
            raise ForbiddenError("Not a member of that community", code="INVALID_SCOPE")
        return TenantScope(user.id, is_global=False, community_ids=frozenset({wanted}))

    scope = TenantScope(user.id, is_global, community_ids)
    request.state.tenant_scope = scope
    return scope


@dataclass
class AsyncTenantContext:
    db: AsyncSession
    scope: TenantScope


async def async_tenant_context(
    db: AsyncSession = Depends(get_async_db),
    scope: TenantScope = Depends(get_tenant_scope_async),
) -> AsyncTenantContext:
    await bind_rls_scope_async(db, scope)
    return AsyncTenantContext(db=db, scope=scope)

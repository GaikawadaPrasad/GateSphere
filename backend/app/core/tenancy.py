"""Multi-tenant scope resolution (AGENTS.md §3).

`get_tenant_scope_async` resolves the set of community ids the caller may touch, from their
role grants — **never** from a client-supplied value. Community-scoped modules inject it
and pass it to every repository call; the repository applies it before query execution.

Super Admin / Auditor resolve to ALL communities; a `X-Community-Id` header lets Super
Admin narrow the active community for a request.

The scope also carries the caller's **effective permissions for the active community**
(role defaults ± that community's `community_role_permissions` overrides) so a service can
do `scope.require_permission("billing:approve")` for community-specific gating. The
route-level `require_permission_async` gate stays coarse (union across all the user's roles).
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field

from fastapi import Depends, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError
from app.core.security import require_auth_async, user_permissions_async
from app.db.session import get_async_db
from app.modules.users.models import User, UserRole


@dataclass(frozen=True)
class TenantScope:
    user_id: uuid.UUID
    is_global: bool
    community_ids: frozenset[uuid.UUID]  # empty + is_global => all communities
    permissions: frozenset[str] = field(default_factory=frozenset)

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

    def can(self, code: str) -> bool:
        return "*" in self.permissions or code in self.permissions

    def require_permission(self, code: str) -> None:
        if not self.can(code):
            raise ForbiddenError(f"Missing permission: {code}", code="PERMISSION_DENIED")


async def bind_rls_scope_async(db: AsyncSession, scope: TenantScope) -> None:
    """Set the request-scoped GUC the RLS policies read (migration 0003).

    No-op for a global scope. Safe to call once per request after the scope is known.
    """
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
            scope = TenantScope(
                user.id, is_global=False, community_ids=active, permissions=frozenset({"*"})
            )
        else:
            scope = TenantScope(
                user.id, is_global=True, community_ids=frozenset(), permissions=frozenset({"*"})
            )
        request.state.tenant_scope = scope
        return scope

    rows = (
        await db.scalars(select(UserRole.community_id).where(UserRole.user_id == user.id))
    ).all()
    community_ids = frozenset(cid for cid in rows if cid is not None)
    is_global = any(cid is None for cid in rows)

    active_cid: uuid.UUID | None = None
    if x_community_id:
        try:
            wanted = uuid.UUID(x_community_id)
        except ValueError as exc:
            raise ForbiddenError("Invalid X-Community-Id", code="INVALID_SCOPE") from exc
        if not is_global and wanted not in community_ids:
            raise ForbiddenError("Not a member of that community", code="INVALID_SCOPE")
        community_ids, is_global, active_cid = frozenset({wanted}), False, wanted
    elif len(community_ids) == 1 and not is_global:
        active_cid = next(iter(community_ids))

    perms = frozenset(await user_permissions_async(db, user, community_id=active_cid))
    scope = TenantScope(user.id, is_global, community_ids, permissions=perms)
    request.state.tenant_scope = scope
    return scope


def require_permission_async(code: str) -> Callable[..., TenantScope]:
    """Route-level RBAC gate. Checks the caller's **effective** permissions.

    `get_tenant_scope_async` resolves `scope.permissions` to the effective set for the
    caller's *active* community when that is unambiguous (a single community grant, or an
    `X-Community-Id` header) — i.e. role defaults with that community's
    `community_role_permissions` overrides (allow/deny) applied. For a global or
    multi-community caller it is the coarse union across every role they hold. Superadmin
    resolves to `{"*"}`.
    """

    async def dep(scope: TenantScope = Depends(get_tenant_scope_async)) -> TenantScope:
        if scope.can(code):
            return scope
        raise ForbiddenError(f"Missing permission: {code}", code="PERMISSION_DENIED")

    return dep


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

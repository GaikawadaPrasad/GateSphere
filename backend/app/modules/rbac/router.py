"""Configurable RBAC API (FR-02 extension). Canonical envelope.

- **Reads** (`/rbac/permissions`, `/rbac/roles`, community overrides, effective) — `users:view`.
- **Writes** — **platform admin only** (`require_platform_admin`): editing a global role's
  permission set, and per-community role-permission overrides.

Contract: docs/backend/api/rbac.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import require_platform_admin
from app.core.tenancy import require_permission_async
from app.modules.rbac import schemas
from app.modules.rbac.deps import rbac_service
from app.modules.rbac.service import RbacService

router = APIRouter(prefix="/rbac", tags=["RBAC configuration"])

VIEW = Depends(require_permission_async("users:view"))
ADMIN = Depends(require_platform_admin)
Svc = RbacService


@router.get("/health", summary="RBAC module liveness")
async def module_health() -> dict:
    return ok({"module": "rbac", "status": "ok"})


@router.get(
    "/permissions", response_model=Envelope[list[schemas.PermissionRead]], dependencies=[VIEW]
)
async def list_permissions(svc: Svc = Depends(rbac_service)) -> dict:
    return ok(await svc.list_permissions())


@router.get("/roles", response_model=Envelope[list[schemas.RolePermsRead]], dependencies=[VIEW])
async def list_roles(svc: Svc = Depends(rbac_service)) -> dict:
    return ok(await svc.list_roles())


@router.put(
    "/roles/{slug}/permissions",
    response_model=Envelope[schemas.RolePermsRead],
    dependencies=[ADMIN],
)
async def set_role_permissions(
    slug: str, payload: schemas.RolePermsSet, svc: Svc = Depends(rbac_service)
) -> dict:
    return ok(await svc.set_role_permissions(slug, payload), message="Updated")


@router.post(
    "/roles/{slug}/permissions",
    response_model=Envelope[schemas.RolePermsRead],
    dependencies=[ADMIN],
)
async def add_role_permission(
    slug: str, payload: schemas.PermCodeIn, svc: Svc = Depends(rbac_service)
) -> dict:
    return ok(await svc.add_role_permission(slug, payload.code), message="Added")


@router.delete(
    "/roles/{slug}/permissions/{code}",
    response_model=Envelope[schemas.RolePermsRead],
    dependencies=[ADMIN],
)
async def remove_role_permission(slug: str, code: str, svc: Svc = Depends(rbac_service)) -> dict:
    return ok(await svc.remove_role_permission(slug, code), message="Removed")


@router.post(
    "/roles/{slug}/permissions/reset",
    response_model=Envelope[schemas.RolePermsRead],
    dependencies=[ADMIN],
)
async def reset_role_permissions(slug: str, svc: Svc = Depends(rbac_service)) -> dict:
    return ok(await svc.reset_role_permissions(slug), message="Reset to defaults")


# --- per-community overrides ------------------------------------------ #
@router.get(
    "/communities/{community_id}/overrides",
    response_model=Envelope[list[schemas.CommunityOverrideRead]],
    dependencies=[VIEW],
)
async def list_community_overrides(
    community_id: uuid.UUID, svc: Svc = Depends(rbac_service)
) -> dict:
    return ok(await svc.list_community_overrides(community_id))


@router.get(
    "/communities/{community_id}/roles/{slug}/effective",
    response_model=Envelope[schemas.EffectivePermsRead],
    dependencies=[VIEW],
)
async def effective_permissions(
    community_id: uuid.UUID, slug: str, svc: Svc = Depends(rbac_service)
) -> dict:
    return ok(await svc.effective_permissions(community_id, slug))


@router.put(
    "/communities/{community_id}/roles/{slug}/permissions",
    response_model=Envelope[schemas.EffectivePermsRead],
    dependencies=[ADMIN],
)
async def set_community_role_overrides(
    community_id: uuid.UUID,
    slug: str,
    payload: schemas.CommunityRoleOverridesSet,
    svc: Svc = Depends(rbac_service),
) -> dict:
    return ok(
        await svc.set_community_role_overrides(community_id, slug, payload), message="Updated"
    )


@router.delete(
    "/communities/{community_id}/roles/{slug}/permissions/{code}",
    response_model=Envelope[schemas.EffectivePermsRead],
    dependencies=[ADMIN],
)
async def remove_community_override(
    community_id: uuid.UUID, slug: str, code: str, svc: Svc = Depends(rbac_service)
) -> dict:
    return ok(await svc.remove_community_override(community_id, slug, code), message="Removed")

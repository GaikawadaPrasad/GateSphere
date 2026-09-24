"""Dashboards API (FR-14). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `dashboards:view`. Read-only aggregates, community-scoped.
Cache: short-TTL Redis cache (REC-003) — see cache.py.
Contract: docs/backend/api/dashboards.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError
from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import require_auth_async, require_platform_admin
from app.core.tenancy import TenantScope, get_tenant_scope_async, require_permission_async
from app.db.session import get_async_db
from app.modules.assistant import schemas as assistant_schemas
from app.modules.assistant.deps import assistant_service
from app.modules.assistant.service import AssistantService
from app.modules.dashboards import schemas
from app.modules.dashboards.cache import get_cached, set_cached
from app.modules.dashboards.deps import dashboard_service
from app.modules.dashboards.service import DashboardService
from app.modules.residents.access import actor_unit_scope
from app.modules.users.models import User

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

VIEW = Depends(require_permission_async("dashboards:view"))
GATE_VIEW = Depends(require_permission_async("gate:view"))
BILLING_VIEW = Depends(require_permission_async("billing:view"))
PLATFORM_ADMIN = Depends(require_platform_admin)


async def require_financial_dashboard_async(
    scope: TenantScope = Depends(get_tenant_scope_async),
    user: User = Depends(require_auth_async),
    db: AsyncSession = Depends(get_async_db, scope="function"),
) -> TenantScope:
    if not scope.can("billing:view"):
        raise ForbiddenError("Missing permission: billing:view", code="PERMISSION_DENIED")
    active_cid = next(iter(scope.community_ids)) if len(scope.community_ids) == 1 else None
    unit_scope = await actor_unit_scope(db, user, community_id=active_cid)
    if unit_scope is not None:
        raise ForbiddenError(
            "Residents cannot access community financial totals", code="PERMISSION_DENIED"
        )
    return scope


async def require_security_dashboard_async(
    scope: TenantScope = Depends(get_tenant_scope_async),
    user: User = Depends(require_auth_async),
    db: AsyncSession = Depends(get_async_db, scope="function"),
) -> TenantScope:
    if not scope.can("gate:view"):
        raise ForbiddenError("Missing permission: gate:view", code="PERMISSION_DENIED")
    active_cid = next(iter(scope.community_ids)) if len(scope.community_ids) == 1 else None
    unit_scope = await actor_unit_scope(db, user, community_id=active_cid)
    if unit_scope is not None:
        raise ForbiddenError(
            "Residents cannot access community security dashboard", code="PERMISSION_DENIED"
        )
    return scope


SECURITY_DASHBOARD = Depends(require_security_dashboard_async)
FINANCIAL_DASHBOARD = Depends(require_financial_dashboard_async)
Svc = DashboardService


@router.get("/health", summary="Dashboards module liveness")
async def module_health() -> dict:
    return ok({"module": "dashboards", "status": "ok"})


@router.get(
    "/super-admin",
    response_model=Envelope[schemas.SuperAdminDashboardStats],
    dependencies=[PLATFORM_ADMIN],
)
async def super_admin_stats(
    community_id: uuid.UUID | None = None,
    refresh: bool = False,
    svc: Svc = Depends(dashboard_service),
) -> dict:
    if not refresh:
        cached = get_cached("super-admin", community_id)
        if cached is not None:
            return ok(cached)
    result = await svc.super_admin_stats(community_id)
    data = result.model_dump(mode="json")
    set_cached("super-admin", community_id, data)
    return ok(data)


@router.get("/overview", response_model=Envelope[schemas.OverviewStats], dependencies=[VIEW])
async def overview(
    community_id: uuid.UUID | None = None,
    refresh: bool = False,
    svc: Svc = Depends(dashboard_service),
) -> dict:
    if not refresh:
        cached = get_cached("overview", community_id)
        if cached is not None:
            return ok(cached)
    result = await svc.overview(community_id)
    data = result.model_dump(mode="json")
    set_cached("overview", community_id, data)
    return ok(data)


@router.get(
    "/security", response_model=Envelope[schemas.SecurityStats], dependencies=[SECURITY_DASHBOARD]
)
async def security(
    community_id: uuid.UUID | None = None,
    refresh: bool = False,
    svc: Svc = Depends(dashboard_service),
) -> dict:
    if not refresh:
        cached = get_cached("security", community_id)
        if cached is not None:
            return ok(cached)
    result = await svc.security(community_id)
    data = result.model_dump(mode="json")
    set_cached("security", community_id, data)
    return ok(data)


@router.get(
    "/financial",
    response_model=Envelope[schemas.FinancialStats],
    dependencies=[FINANCIAL_DASHBOARD],
)
async def financial(
    community_id: uuid.UUID | None = None,
    refresh: bool = False,
    svc: Svc = Depends(dashboard_service),
) -> dict:
    if not refresh:
        cached = get_cached("financial", community_id)
        if cached is not None:
            return ok(cached)
    result = await svc.financial(community_id)
    data = result.model_dump(mode="json")
    set_cached("financial", community_id, data)
    return ok(data)


@router.get("/resident", response_model=Envelope[schemas.ResidentStats], dependencies=[VIEW])
async def resident(
    community_id: uuid.UUID | None = None,
    refresh: bool = False,
    svc: Svc = Depends(dashboard_service),
) -> dict:
    # Resident dashboard is user-specific (my_open_tickets, my_balance, etc.)
    user_id = svc.actor.id if hasattr(svc, "actor") else None
    if not refresh:
        cached = get_cached("resident", community_id, user_id=user_id)
        if cached is not None:
            return ok(cached)
    result = await svc.resident(community_id)
    data = result.model_dump(mode="json")
    set_cached("resident", community_id, data, user_id=user_id)
    return ok(data)


@router.post(
    "/assistant/query",
    response_model=Envelope[assistant_schemas.AssistantResponse],
    dependencies=[VIEW],
    summary="[Legacy] Query the assistant — superseded by POST /assistant/query",
)
async def legacy_assistant_query(
    payload: assistant_schemas.AssistantQueryRequest,
    svc: AssistantService = Depends(assistant_service),
) -> dict:
    return ok(await svc.query(payload.community_id, payload.query))

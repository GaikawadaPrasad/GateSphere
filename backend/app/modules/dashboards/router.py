"""Dashboards API (FR-14). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `dashboards:view`. Read-only aggregates, community-scoped.
Cache: short-TTL Redis cache (REC-003) — see cache.py.
Contract: docs/backend/api/dashboards.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.tenancy import require_permission_async
from app.modules.assistant import schemas as assistant_schemas
from app.modules.assistant.deps import assistant_service
from app.modules.assistant.service import AssistantService
from app.modules.dashboards import schemas
from app.modules.dashboards.cache import get_cached, set_cached
from app.modules.dashboards.deps import dashboard_service
from app.modules.dashboards.service import DashboardService

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

VIEW = Depends(require_permission_async("dashboards:view"))
Svc = DashboardService


@router.get("/health", summary="Dashboards module liveness")
async def module_health() -> dict:
    return ok({"module": "dashboards", "status": "ok"})


@router.get(
    "/super-admin",
    response_model=Envelope[schemas.SuperAdminDashboardStats],
    dependencies=[VIEW],
)
async def super_admin_stats(svc: Svc = Depends(dashboard_service)) -> dict:
    cached = get_cached("super-admin", None)
    if cached is not None:
        return ok(cached)
    result = await svc.super_admin_stats()
    data = result.model_dump(mode="json")
    set_cached("super-admin", None, data)
    return ok(data)


@router.get("/overview", response_model=Envelope[schemas.OverviewStats], dependencies=[VIEW])
async def overview(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    cached = get_cached("overview", community_id)
    if cached is not None:
        return ok(cached)
    result = await svc.overview(community_id)
    data = result.model_dump(mode="json")
    set_cached("overview", community_id, data)
    return ok(data)


@router.get("/security", response_model=Envelope[schemas.SecurityStats], dependencies=[VIEW])
async def security(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    cached = get_cached("security", community_id)
    if cached is not None:
        return ok(cached)
    result = await svc.security(community_id)
    data = result.model_dump(mode="json")
    set_cached("security", community_id, data)
    return ok(data)


@router.get("/financial", response_model=Envelope[schemas.FinancialStats], dependencies=[VIEW])
async def financial(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    cached = get_cached("financial", community_id)
    if cached is not None:
        return ok(cached)
    result = await svc.financial(community_id)
    data = result.model_dump(mode="json")
    set_cached("financial", community_id, data)
    return ok(data)


@router.get("/resident", response_model=Envelope[schemas.ResidentStats], dependencies=[VIEW])
async def resident(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    # Resident dashboard is user-specific (my_open_tickets, my_balance, etc.)
    user_id = svc.actor.id if hasattr(svc, "actor") else None
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

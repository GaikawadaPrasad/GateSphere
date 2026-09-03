"""Dashboards API (FR-14). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `dashboards:view`. Read-only aggregates, community-scoped.
Contract: docs/backend/api/dashboards.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.tenancy import require_permission_async
from app.modules.dashboards import schemas
from app.modules.dashboards.deps import dashboard_service
from app.modules.dashboards.service import DashboardService

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

VIEW = Depends(require_permission_async("dashboards:view"))
Svc = DashboardService


@router.get("/health", summary="Dashboards module liveness")
async def module_health() -> dict:
    return ok({"module": "dashboards", "status": "ok"})


@router.get("/overview", response_model=Envelope[schemas.OverviewStats], dependencies=[VIEW])
async def overview(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    return ok(await svc.overview(community_id))


@router.get("/security", response_model=Envelope[schemas.SecurityStats], dependencies=[VIEW])
async def security(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    return ok(await svc.security(community_id))


@router.get("/financial", response_model=Envelope[schemas.FinancialStats], dependencies=[VIEW])
async def financial(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    return ok(await svc.financial(community_id))


@router.get("/resident", response_model=Envelope[schemas.ResidentStats], dependencies=[VIEW])
async def resident(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    return ok(await svc.resident(community_id))


@router.get(
    "/assistant/quick-actions",
    response_model=Envelope[schemas.AssistantQuickActionsResponse],
    dependencies=[VIEW],
    summary="Get role-specific assistant quick chips and suggestions",
)
async def assistant_quick_actions(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)
) -> dict:
    return ok(await svc.assistant_quick_actions(community_id))


@router.post(
    "/assistant/query",
    response_model=Envelope[schemas.AssistantResponse],
    dependencies=[VIEW],
    summary="Query the dashboard assistant / FAQ helper",
)
async def assistant_query(
    payload: schemas.AssistantQueryRequest, svc: Svc = Depends(dashboard_service)
) -> dict:
    return ok(await svc.assistant_query(payload.community_id, payload.query))


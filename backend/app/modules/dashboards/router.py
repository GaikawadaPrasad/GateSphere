"""Dashboards API (FR-14). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `dashboards:view`. Read-only aggregates, community-scoped.
Contract: docs/backend/api/dashboards.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import require_permission
from app.modules.dashboards import schemas
from app.modules.dashboards.deps import dashboard_service
from app.modules.dashboards.service import DashboardService

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

VIEW = Depends(require_permission("dashboards:view"))
Svc = DashboardService


@router.get("/health", summary="Dashboards module liveness")
async def module_health() -> dict:
    return ok({"module": "dashboards", "status": "ok"})


@router.get("/overview", response_model=Envelope[schemas.OverviewStats], dependencies=[VIEW])
def overview(community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)) -> dict:
    return ok(svc.overview(community_id))


@router.get("/security", response_model=Envelope[schemas.SecurityStats], dependencies=[VIEW])
def security(community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)) -> dict:
    return ok(svc.security(community_id))


@router.get("/financial", response_model=Envelope[schemas.FinancialStats], dependencies=[VIEW])
def financial(community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)) -> dict:
    return ok(svc.financial(community_id))


@router.get("/resident", response_model=Envelope[schemas.ResidentStats], dependencies=[VIEW])
def resident(community_id: uuid.UUID | None = None, svc: Svc = Depends(dashboard_service)) -> dict:
    return ok(svc.resident(community_id))

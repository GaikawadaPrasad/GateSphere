"""Assistant API (FR-14 & FR-19). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `dashboards:view`. Conversational AI assistant & FAQ knowledge base.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.tenancy import require_permission_async
from app.modules.assistant import schemas
from app.modules.assistant.deps import assistant_service
from app.modules.assistant.service import AssistantService

router = APIRouter(prefix="/assistant", tags=["Assistant"])

VIEW = Depends(require_permission_async("dashboards:view"))
Svc = AssistantService


@router.get("/health", summary="Assistant module liveness")
async def module_health() -> dict:
    return ok({"module": "assistant", "status": "ok"})


@router.get(
    "/quick-actions",
    response_model=Envelope[schemas.AssistantQuickActionsResponse],
    dependencies=[VIEW],
    summary="Get role-specific assistant quick chips and suggestions",
)
async def assistant_quick_actions(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(assistant_service)
) -> dict:
    return ok(await svc.quick_actions(community_id))


@router.post(
    "/query",
    response_model=Envelope[schemas.AssistantResponse],
    dependencies=[VIEW],
    summary="Query the conversational AI assistant / FAQ knowledge base",
)
async def assistant_query(
    payload: schemas.AssistantQueryRequest, svc: Svc = Depends(assistant_service)
) -> dict:
    return ok(await svc.query(payload.community_id, payload.query))

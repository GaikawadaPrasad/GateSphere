"""Audit Logging query API (FR-16). Read-only — `audit_logs` is immutable.

Canonical envelope. RBAC: `audit:view` (+ `audit:export` for CSV). Results are community-scoped.
Contract: docs/backend/api/audit.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Response

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission_async
from app.modules.audit import schemas
from app.modules.audit.deps import audit_query_service
from app.modules.audit.query_service import AuditQueryService

router = APIRouter(prefix="/audit", tags=["Audit Logging"])

VIEW = Depends(require_permission_async("audit:view"))
EXPORT = Depends(require_permission_async("audit:export"))
Svc = AuditQueryService


def _filters(
    community_id: uuid.UUID | None = None,
    module: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    user_id: uuid.UUID | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
) -> dict:
    return {
        "community_id": community_id,
        "module": module,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user_id,
        "since": since,
        "until": until,
    }


@router.get("/health", summary="Audit Logging module liveness")
async def module_health() -> dict:
    return ok({"module": "audit", "status": "ok"})


@router.get("/logs", response_model=Envelope[list[schemas.AuditLogRead]], dependencies=[VIEW])
async def list_logs(
    filters: dict = Depends(_filters),
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(audit_query_service),
) -> dict:
    rows, total = await svc.list_logs(offset=params.offset, limit=params.page_size, **filters)
    return paginated(
        [schemas.AuditLogRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get("/logs.csv", dependencies=[EXPORT])
async def export_logs(
    filters: dict = Depends(_filters), svc: Svc = Depends(audit_query_service)
) -> Response:
    csv_text = await svc.export_csv(**filters)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit_logs.csv"'},
    )


@router.get("/logs/{log_id}", response_model=Envelope[schemas.AuditLogRead], dependencies=[VIEW])
async def get_log(log_id: uuid.UUID, svc: Svc = Depends(audit_query_service)) -> dict:
    return ok(schemas.AuditLogRead.model_validate(await svc.get_log(log_id)))

"""Emergency & Incident Management API (FR-13). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `incidents:{view,create,update}`.
Contract: docs/backend/api/incidents.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.incidents import schemas
from app.modules.incidents.deps import incident_service
from app.modules.incidents.service import IncidentService

router = APIRouter(prefix="/incidents", tags=["Emergency & Incident Management"])

VIEW = Depends(require_permission_async("incidents:view"))
CREATE = Depends(require_permission_async("incidents:create"))
UPDATE = Depends(require_permission_async("incidents:update"))

Svc = IncidentService


@router.get("/health", summary="Incident Management module liveness")
async def module_health() -> dict:
    return ok({"module": "incidents", "status": "ok"})


@router.get("", response_model=Envelope[list[schemas.IncidentRead]], dependencies=[VIEW])
async def list_incidents(
    community_id: uuid.UUID | None = None,
    incident_status: str | None = None,
    severity: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(incident_service),
) -> dict:
    rows, total = await svc.list_incidents(
        community_id=community_id,
        incident_status=incident_status,
        severity=severity,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.IncidentRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.IncidentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_incident(
    payload: schemas.IncidentCreate, svc: Svc = Depends(incident_service)
) -> dict:
    return ok(
        schemas.IncidentRead.model_validate(await svc.create_incident(payload)),
        message="Incident logged",
    )


@router.get("/{incident_id}", response_model=Envelope[schemas.IncidentRead], dependencies=[VIEW])
async def get_incident(incident_id: uuid.UUID, svc: Svc = Depends(incident_service)) -> dict:
    return ok(schemas.IncidentRead.model_validate(await svc.get_incident(incident_id)))


@router.patch(
    "/{incident_id}", response_model=Envelope[schemas.IncidentRead], dependencies=[UPDATE]
)
async def update_incident(
    incident_id: uuid.UUID,
    payload: schemas.IncidentUpdate,
    svc: Svc = Depends(incident_service),
) -> dict:
    return ok(
        schemas.IncidentRead.model_validate(await svc.update_incident(incident_id, payload)),
        message="Updated",
    )


@router.post(
    "/{incident_id}/transition",
    response_model=Envelope[schemas.IncidentRead],
    dependencies=[UPDATE],
)
async def transition_incident(
    incident_id: uuid.UUID,
    payload: schemas.IncidentTransition,
    svc: Svc = Depends(incident_service),
) -> dict:
    return ok(
        schemas.IncidentRead.model_validate(await svc.transition_incident(incident_id, payload)),
        message="Updated",
    )


@router.get(
    "/{incident_id}/history",
    response_model=Envelope[list[schemas.HistoryRead]],
    dependencies=[VIEW],
)
async def incident_history(incident_id: uuid.UUID, svc: Svc = Depends(incident_service)) -> dict:
    return ok([schemas.HistoryRead.model_validate(h) for h in await svc.list_history(incident_id)])


@router.get(
    "/{incident_id}/assignments",
    response_model=Envelope[list[schemas.AssignmentRead]],
    dependencies=[VIEW],
)
async def incident_assignments(
    incident_id: uuid.UUID, svc: Svc = Depends(incident_service)
) -> dict:
    return ok(
        [schemas.AssignmentRead.model_validate(a) for a in await svc.list_assignments(incident_id)]
    )


@router.post(
    "/{incident_id}/assignments",
    response_model=Envelope[schemas.AssignmentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
async def assign(
    incident_id: uuid.UUID, payload: schemas.AssignIn, svc: Svc = Depends(incident_service)
) -> dict:
    return ok(
        schemas.AssignmentRead.model_validate(await svc.assign(incident_id, payload)),
        message="Assigned",
    )


@router.post(
    "/assignments/{assignment_id}/release",
    response_model=Envelope[schemas.AssignmentRead],
    dependencies=[UPDATE],
)
async def release(assignment_id: uuid.UUID, svc: Svc = Depends(incident_service)) -> dict:
    return ok(
        schemas.AssignmentRead.model_validate(await svc.release(assignment_id)), message="Released"
    )


@router.get(
    "/{incident_id}/actions",
    response_model=Envelope[list[schemas.ActionRead]],
    dependencies=[VIEW],
)
async def incident_actions(incident_id: uuid.UUID, svc: Svc = Depends(incident_service)) -> dict:
    return ok([schemas.ActionRead.model_validate(a) for a in await svc.list_actions(incident_id)])


@router.post(
    "/{incident_id}/actions",
    response_model=Envelope[schemas.ActionRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
async def add_action(
    incident_id: uuid.UUID, payload: schemas.ActionIn, svc: Svc = Depends(incident_service)
) -> dict:
    return ok(
        schemas.ActionRead.model_validate(await svc.add_action(incident_id, payload)),
        message="Logged",
    )


@router.get(
    "/{incident_id}/attachments",
    response_model=Envelope[list[schemas.AttachmentRead]],
    dependencies=[VIEW],
)
async def incident_attachments(
    incident_id: uuid.UUID, svc: Svc = Depends(incident_service)
) -> dict:
    return ok(
        [schemas.AttachmentRead.model_validate(a) for a in await svc.list_attachments(incident_id)]
    )


@router.post(
    "/{incident_id}/attachments",
    response_model=Envelope[schemas.AttachmentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
async def add_attachment(
    incident_id: uuid.UUID,
    payload: schemas.AttachmentIn,
    svc: Svc = Depends(incident_service),
) -> dict:
    return ok(
        schemas.AttachmentRead.model_validate(await svc.add_attachment(incident_id, payload)),
        message="Attached",
    )

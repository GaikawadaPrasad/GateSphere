"""Gate / Security Operations API (FR-05). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `gate:{view,create,update}`. Raising a panic alert only
requires an authenticated session (any resident can trigger SOS).
Contract: docs/backend/api/gate.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission_async
from app.modules.gate import schemas
from app.modules.gate.deps import gate_service
from app.modules.gate.service import GateService

router = APIRouter(prefix="/gate", tags=["Gate Operations"])

VIEW = Depends(require_permission_async("gate:view"))
CREATE = Depends(require_permission_async("gate:create"))
UPDATE = Depends(require_permission_async("gate:update"))
APPROVE = Depends(require_permission_async("gate:approve"))  # Security Supervisor / Community Admin


@router.get("/health", summary="Gate Operations module liveness")
async def module_health() -> dict:
    return ok({"module": "gate", "status": "ok"})


# --- gate events -------------------------------------------------------- #
@router.get("/events", response_model=Envelope[list[schemas.EventRead]], dependencies=[VIEW])
async def list_events(
    community_id: uuid.UUID | None = None,
    gate_id: uuid.UUID | None = None,
    event_type: str | None = None,
    params: PageParams = Depends(page_params),
    svc: GateService = Depends(gate_service),
) -> dict:
    rows, total = await svc.list_events(
        community_id=community_id,
        gate_id=gate_id,
        event_type=event_type,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.EventRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/events",
    response_model=Envelope[schemas.EventRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def log_event(payload: schemas.EventCreate, svc: GateService = Depends(gate_service)) -> dict:
    return ok(
        schemas.EventRead.model_validate(await svc.log_event(payload)), message="Event logged"
    )


@router.post(
    "/checkpoint-override",
    response_model=Envelope[schemas.EventRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
async def override_checkpoint(
    payload: schemas.CheckpointOverride, svc: GateService = Depends(gate_service)
) -> dict:
    return ok(
        schemas.EventRead.model_validate(await svc.override_checkpoint(payload)),
        message="Checkpoint overridden",
    )


# --- guard rosters --------------------------------------------------- #
@router.get("/rosters", response_model=Envelope[list[schemas.RosterRead]], dependencies=[VIEW])
async def list_rosters(
    community_id: uuid.UUID | None = None,
    guard_user_id: uuid.UUID | None = None,
    roster_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: GateService = Depends(gate_service),
) -> dict:
    rows, total = await svc.list_rosters(
        community_id=community_id,
        guard_user_id=guard_user_id,
        roster_status=roster_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.RosterRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/rosters",
    response_model=Envelope[schemas.RosterRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_roster(
    payload: schemas.RosterCreate,
    community_id: uuid.UUID | None = None,
    svc: GateService = Depends(gate_service),
) -> dict:
    return ok(
        schemas.RosterRead.model_validate(
            await svc.create_roster(payload, community_id=community_id)
        ),
        message="Roster created",
    )


@router.patch(
    "/rosters/{roster_id}", response_model=Envelope[schemas.RosterRead], dependencies=[UPDATE]
)
async def update_roster(
    roster_id: uuid.UUID,
    payload: schemas.RosterUpdate,
    svc: GateService = Depends(gate_service),
) -> dict:
    return ok(
        schemas.RosterRead.model_validate(await svc.update_roster(roster_id, payload)),
        message="Updated",
    )


@router.post(
    "/rosters/{roster_id}/status",
    response_model=Envelope[schemas.RosterRead],
    dependencies=[UPDATE],
)
async def transition_roster(
    roster_id: uuid.UUID,
    payload: schemas.RosterTransition,
    svc: GateService = Depends(gate_service),
) -> dict:
    return ok(
        schemas.RosterRead.model_validate(
            await svc.transition_roster(roster_id, payload.status, payload.reason)
        ),
        message="Updated",
    )


# --- gate assignments --------------------------------------------- #
@router.get(
    "/assignments", response_model=Envelope[list[schemas.AssignmentRead]], dependencies=[VIEW]
)
async def list_assignments(
    community_id: uuid.UUID | None = None,
    gate_id: uuid.UUID | None = None,
    active_only: bool = False,
    params: PageParams = Depends(page_params),
    svc: GateService = Depends(gate_service),
) -> dict:
    rows, total = await svc.list_assignments(
        community_id=community_id,
        gate_id=gate_id,
        active_only=active_only,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.AssignmentRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/assignments",
    response_model=Envelope[schemas.AssignmentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_assignment(
    payload: schemas.AssignmentCreate,
    community_id: uuid.UUID | None = None,
    svc: GateService = Depends(gate_service),
) -> dict:
    return ok(
        schemas.AssignmentRead.model_validate(
            await svc.create_assignment(payload, community_id=community_id)
        ),
        message="Assigned",
    )


@router.post(
    "/assignments/{assignment_id}/end",
    response_model=Envelope[schemas.AssignmentRead],
    dependencies=[UPDATE],
)
async def end_assignment(
    assignment_id: uuid.UUID, svc: GateService = Depends(gate_service)
) -> dict:
    return ok(
        schemas.AssignmentRead.model_validate(await svc.end_assignment(assignment_id)),
        message="Ended",
    )


# --- panic alerts ----------------------------------------------- #
@router.get("/alerts", response_model=Envelope[list[schemas.AlertRead]], dependencies=[VIEW])
async def list_alerts(
    community_id: uuid.UUID | None = None,
    alert_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: GateService = Depends(gate_service),
) -> dict:
    rows, total = await svc.list_alerts(
        community_id=community_id,
        alert_status=alert_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.AlertRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/alerts",
    response_model=Envelope[schemas.AlertRead],
    status_code=status.HTTP_201_CREATED,
)
async def raise_alert(
    payload: schemas.AlertCreate, svc: GateService = Depends(gate_service)
) -> dict:
    return ok(
        schemas.AlertRead.model_validate(await svc.raise_alert(payload)), message="Alert raised"
    )


@router.post(
    "/alerts/{alert_id}/acknowledge",
    response_model=Envelope[schemas.AlertRead],
    dependencies=[UPDATE],
)
async def acknowledge_alert(alert_id: uuid.UUID, svc: GateService = Depends(gate_service)) -> dict:
    return ok(
        schemas.AlertRead.model_validate(await svc.acknowledge_alert(alert_id)),
        message="Acknowledged",
    )


@router.post(
    "/alerts/{alert_id}/resolve", response_model=Envelope[schemas.AlertRead], dependencies=[UPDATE]
)
async def resolve_alert(
    alert_id: uuid.UUID,
    payload: schemas.AlertResolve,
    svc: GateService = Depends(gate_service),
) -> dict:
    return ok(
        schemas.AlertRead.model_validate(await svc.resolve_alert(alert_id, payload)),
        message="Resolved",
    )


@router.post("/alerts/{alert_id}/cancel", response_model=Envelope[schemas.AlertRead])
async def cancel_alert(alert_id: uuid.UUID, svc: GateService = Depends(gate_service)) -> dict:
    return ok(
        schemas.AlertRead.model_validate(await svc.cancel_alert(alert_id)), message="Cancelled"
    )

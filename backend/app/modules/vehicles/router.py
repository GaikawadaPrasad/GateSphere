"""Vehicle & Parking API (FR-08). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `vehicles:{view,create,update,approve}`.
Contract: docs/backend/api/vehicles.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.vehicles import schemas
from app.modules.vehicles.deps import vehicle_service
from app.modules.vehicles.service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Vehicle & Parking"])

VIEW = Depends(require_permission("vehicles:view"))
CREATE = Depends(require_permission("vehicles:create"))
UPDATE = Depends(require_permission("vehicles:update"))
APPROVE = Depends(require_permission("vehicles:approve"))

Svc = VehicleService


@router.get("/health", summary="Vehicle & Parking module liveness")
async def module_health() -> dict:
    return ok({"module": "vehicles", "status": "ok"})


# --- parking rules -------------------------------------------------- #
@router.get("/parking/rules", response_model=Envelope[schemas.RuleRead], dependencies=[VIEW])
def get_rule(community_id: uuid.UUID | None = None, svc: Svc = Depends(vehicle_service)) -> dict:
    return ok(schemas.RuleRead.model_validate(svc.get_rule(community_id=community_id)))


@router.patch("/parking/rules", response_model=Envelope[schemas.RuleRead], dependencies=[APPROVE])
def update_rule(
    payload: schemas.RuleUpdate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(vehicle_service),
) -> dict:
    return ok(
        schemas.RuleRead.model_validate(svc.update_rule(payload, community_id=community_id)),
        message="Updated",
    )


# --- parking slots ------------------------------------------------ #
@router.get("/parking/slots", response_model=Envelope[list[schemas.SlotRead]], dependencies=[VIEW])
def list_slots(
    community_id: uuid.UUID | None = None,
    slot_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(vehicle_service),
) -> dict:
    rows, total = svc.list_slots(
        community_id=community_id,
        slot_status=slot_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated([schemas.SlotRead.model_validate(r) for r in rows], total=total, params=params)


@router.post(
    "/parking/slots",
    response_model=Envelope[schemas.SlotRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
def create_slot(
    payload: schemas.SlotCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(vehicle_service),
) -> dict:
    return ok(
        schemas.SlotRead.model_validate(svc.create_slot(payload, community_id=community_id)),
        message="Slot created",
    )


# --- parking allocations --------------------------------------- #
@router.get(
    "/parking/allocations",
    response_model=Envelope[list[schemas.AllocationRead]],
    dependencies=[VIEW],
)
def list_allocations(
    community_id: uuid.UUID | None = None,
    active_only: bool = False,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(vehicle_service),
) -> dict:
    rows, total = svc.list_allocations(
        community_id=community_id,
        active_only=active_only,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.AllocationRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/parking/allocations",
    response_model=Envelope[schemas.AllocationRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
def allocate(payload: schemas.AllocationCreate, svc: Svc = Depends(vehicle_service)) -> dict:
    return ok(schemas.AllocationRead.model_validate(svc.allocate(payload)), message="Allocated")


@router.post(
    "/parking/allocations/{allocation_id}/release",
    response_model=Envelope[schemas.AllocationRead],
    dependencies=[UPDATE],
)
def release(allocation_id: uuid.UUID, svc: Svc = Depends(vehicle_service)) -> dict:
    return ok(schemas.AllocationRead.model_validate(svc.release(allocation_id)), message="Released")


# --- gate entries ------------------------------------------- #
@router.get("/entries", response_model=Envelope[list[schemas.EntryRead]], dependencies=[VIEW])
def list_entries(
    community_id: uuid.UUID | None = None,
    plate: str | None = None,
    open_only: bool = False,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(vehicle_service),
) -> dict:
    rows, total = svc.list_entries(
        community_id=community_id,
        plate=plate,
        open_only=open_only,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.EntryRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/entries",
    response_model=Envelope[schemas.EntryRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def record_entry(
    payload: schemas.EntryCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(vehicle_service),
) -> dict:
    return ok(
        schemas.EntryRead.model_validate(svc.record_entry(payload, community_id=community_id)),
        message="Entry logged",
    )


@router.patch(
    "/entries/{entry_id}/exit", response_model=Envelope[schemas.EntryRead], dependencies=[UPDATE]
)
def record_exit(entry_id: uuid.UUID, svc: Svc = Depends(vehicle_service)) -> dict:
    return ok(schemas.EntryRead.model_validate(svc.record_exit(entry_id)), message="Exit logged")


# --- violations -------------------------------------------- #
@router.get(
    "/parking/violations",
    response_model=Envelope[list[schemas.ViolationRead]],
    dependencies=[VIEW],
)
def list_violations(
    community_id: uuid.UUID | None = None,
    violation_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(vehicle_service),
) -> dict:
    rows, total = svc.list_violations(
        community_id=community_id,
        violation_status=violation_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.ViolationRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/parking/violations",
    response_model=Envelope[schemas.ViolationRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def report_violation(
    payload: schemas.ViolationCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(vehicle_service),
) -> dict:
    return ok(
        schemas.ViolationRead.model_validate(
            svc.report_violation(payload, community_id=community_id)
        ),
        message="Reported",
    )


@router.post(
    "/parking/violations/{violation_id}/status",
    response_model=Envelope[schemas.ViolationRead],
    dependencies=[UPDATE],
)
def transition_violation(
    violation_id: uuid.UUID, new_status: str, svc: Svc = Depends(vehicle_service)
) -> dict:
    return ok(
        schemas.ViolationRead.model_validate(svc.transition_violation(violation_id, new_status)),
        message="Updated",
    )


# --- vehicle registry ------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.VehicleRead]], dependencies=[VIEW])
def list_vehicles(
    community_id: uuid.UUID | None = None,
    q: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(vehicle_service),
) -> dict:
    rows, total = svc.list_vehicles(
        community_id=community_id, q=q, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.VehicleRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.VehicleRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def register_vehicle(
    payload: schemas.VehicleCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(vehicle_service),
) -> dict:
    return ok(
        schemas.VehicleRead.model_validate(
            svc.register_vehicle(payload, community_id=community_id)
        ),
        message="Vehicle registered",
    )


@router.get("/{vehicle_id}", response_model=Envelope[schemas.VehicleRead], dependencies=[VIEW])
def get_vehicle(vehicle_id: uuid.UUID, svc: Svc = Depends(vehicle_service)) -> dict:
    return ok(schemas.VehicleRead.model_validate(svc.get_vehicle(vehicle_id)))


@router.patch("/{vehicle_id}", response_model=Envelope[schemas.VehicleRead], dependencies=[UPDATE])
def update_vehicle(
    vehicle_id: uuid.UUID,
    payload: schemas.VehicleUpdate,
    svc: Svc = Depends(vehicle_service),
) -> dict:
    return ok(
        schemas.VehicleRead.model_validate(svc.update_vehicle(vehicle_id, payload)),
        message="Updated",
    )

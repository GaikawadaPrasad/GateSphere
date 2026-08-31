"""Delivery Management API (FR-07). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `deliveries:{view,create,update,approve}`.
Contract: docs/backend/api/deliveries.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.deliveries import schemas
from app.modules.deliveries.deps import delivery_service
from app.modules.deliveries.service import DeliveryService

router = APIRouter(prefix="/deliveries", tags=["Delivery Management"])

VIEW = Depends(require_permission_async("deliveries:view"))
CREATE = Depends(require_permission_async("deliveries:create"))
UPDATE = Depends(require_permission_async("deliveries:update"))
APPROVE = Depends(require_permission_async("deliveries:approve"))

Svc = DeliveryService


@router.get("/health", summary="Delivery Management module liveness")
async def module_health() -> dict:
    return ok({"module": "deliveries", "status": "ok"})


# --- protocols -------------------------------------------------------- #
@router.get("/protocols", response_model=Envelope[list[schemas.ProtocolRead]], dependencies=[VIEW])
async def list_protocols(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(delivery_service)
) -> dict:
    rows = await svc.list_protocols(community_id=community_id)
    return ok([schemas.ProtocolRead.model_validate(r) for r in rows])


@router.put("/protocols", response_model=Envelope[schemas.ProtocolRead], dependencies=[APPROVE])
async def upsert_protocol(
    payload: schemas.ProtocolUpsert,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(delivery_service),
) -> dict:
    return ok(
        schemas.ProtocolRead.model_validate(
            await svc.upsert_protocol(payload, community_id=community_id)
        ),
        message="Saved",
    )


# --- deliveries --------------------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.DeliveryRead]], dependencies=[VIEW])
async def list_deliveries(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    delivery_status: str | None = None,
    approval_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(delivery_service),
) -> dict:
    rows, total = await svc.list_deliveries(
        community_id=community_id,
        unit_id=unit_id,
        status=delivery_status,
        approval_status=approval_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.DeliveryRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.DeliveryRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_delivery(
    payload: schemas.DeliveryCreate, svc: Svc = Depends(delivery_service)
) -> dict:
    return ok(
        schemas.DeliveryRead.model_validate(await svc.create_delivery(payload)),
        message="Delivery logged",
    )


@router.get("/{delivery_id}", response_model=Envelope[schemas.DeliveryRead], dependencies=[VIEW])
async def get_delivery(delivery_id: uuid.UUID, svc: Svc = Depends(delivery_service)) -> dict:
    return ok(schemas.DeliveryRead.model_validate(await svc.get_delivery(delivery_id)))


@router.get(
    "/{delivery_id}/events",
    response_model=Envelope[list[schemas.EventRead]],
    dependencies=[VIEW],
)
async def list_events(delivery_id: uuid.UUID, svc: Svc = Depends(delivery_service)) -> dict:
    return ok([schemas.EventRead.model_validate(e) for e in await svc.list_events(delivery_id)])


@router.post(
    "/{delivery_id}/decision",
    response_model=Envelope[schemas.DeliveryRead],
    dependencies=[APPROVE],
)
async def decide_delivery(
    delivery_id: uuid.UUID,
    payload: schemas.DeliveryDecision,
    svc: Svc = Depends(delivery_service),
) -> dict:
    return ok(
        schemas.DeliveryRead.model_validate(await svc.decide_delivery(delivery_id, payload)),
        message="Decision recorded",
    )


@router.post(
    "/{delivery_id}/arrival",
    response_model=Envelope[schemas.DeliveryRead],
    dependencies=[UPDATE],
)
async def record_arrival(
    delivery_id: uuid.UUID,
    payload: schemas.DeliveryArrival,
    svc: Svc = Depends(delivery_service),
) -> dict:
    return ok(
        schemas.DeliveryRead.model_validate(await svc.record_arrival(delivery_id, payload)),
        message="Arrival recorded",
    )


@router.post(
    "/{delivery_id}/delivered",
    response_model=Envelope[schemas.DeliveryRead],
    dependencies=[UPDATE],
)
async def mark_delivered(delivery_id: uuid.UUID, svc: Svc = Depends(delivery_service)) -> dict:
    return ok(
        schemas.DeliveryRead.model_validate(await svc.mark_delivered(delivery_id)),
        message="Completed",
    )


@router.post(
    "/{delivery_id}/cancel",
    response_model=Envelope[schemas.DeliveryRead],
    dependencies=[UPDATE],
)
async def cancel_delivery(delivery_id: uuid.UUID, svc: Svc = Depends(delivery_service)) -> dict:
    return ok(
        schemas.DeliveryRead.model_validate(await svc.cancel_delivery(delivery_id)),
        message="Cancelled",
    )

"""Amenity Booking API (FR-11). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `amenities:{view,create,update,approve}`.
Contract: docs/backend/api/amenities.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.amenities import schemas
from app.modules.amenities.deps import amenity_service
from app.modules.amenities.service import AmenityService

router = APIRouter(prefix="/amenities", tags=["Amenity Booking"])

VIEW = Depends(require_permission("amenities:view"))
CREATE = Depends(require_permission("amenities:create"))
UPDATE = Depends(require_permission("amenities:update"))
APPROVE = Depends(require_permission("amenities:approve"))

Svc = AmenityService


@router.get("/health", summary="Amenity Booking module liveness")
async def module_health() -> dict:
    return ok({"module": "amenities", "status": "ok"})


# --- bookings ------------------------------------------------------- #
@router.get("/bookings", response_model=Envelope[list[schemas.BookingRead]], dependencies=[VIEW])
def list_bookings(
    community_id: uuid.UUID | None = None,
    amenity_id: uuid.UUID | None = None,
    booking_status: str | None = None,
    mine: bool = False,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(amenity_service),
) -> dict:
    rows, total = svc.list_bookings(
        community_id=community_id,
        amenity_id=amenity_id,
        booking_status=booking_status,
        mine=mine,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.BookingRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/bookings",
    response_model=Envelope[schemas.BookingRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def book(payload: schemas.BookingCreate, svc: Svc = Depends(amenity_service)) -> dict:
    return ok(schemas.BookingRead.model_validate(svc.book(payload)), message="Booked")


@router.get(
    "/bookings/{booking_id}", response_model=Envelope[schemas.BookingRead], dependencies=[VIEW]
)
def get_booking(booking_id: uuid.UUID, svc: Svc = Depends(amenity_service)) -> dict:
    return ok(schemas.BookingRead.model_validate(svc.get_booking(booking_id)))


@router.post(
    "/bookings/{booking_id}/cancel",
    response_model=Envelope[schemas.BookingRead],
    dependencies=[VIEW],
)
def cancel_booking(
    booking_id: uuid.UUID,
    payload: schemas.BookingCancel,
    svc: Svc = Depends(amenity_service),
) -> dict:
    return ok(
        schemas.BookingRead.model_validate(svc.cancel_booking(booking_id, payload)),
        message="Cancelled",
    )


@router.post(
    "/bookings/{booking_id}/status",
    response_model=Envelope[schemas.BookingRead],
    dependencies=[UPDATE],
)
def mark_booking(
    booking_id: uuid.UUID, new_status: str, svc: Svc = Depends(amenity_service)
) -> dict:
    return ok(
        schemas.BookingRead.model_validate(svc.mark_booking(booking_id, new_status)),
        message="Updated",
    )


# --- amenities + config -------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.AmenityRead]], dependencies=[VIEW])
def list_amenities(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(amenity_service)
) -> dict:
    return ok(
        [
            schemas.AmenityRead.model_validate(a)
            for a in svc.list_amenities(community_id=community_id)
        ]
    )


@router.post(
    "",
    response_model=Envelope[schemas.AmenityRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
def create_amenity(
    payload: schemas.AmenityCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(amenity_service),
) -> dict:
    return ok(
        schemas.AmenityRead.model_validate(svc.create_amenity(payload, community_id=community_id)),
        message="Created",
    )


@router.patch("/{amenity_id}", response_model=Envelope[schemas.AmenityRead], dependencies=[APPROVE])
def update_amenity(
    amenity_id: uuid.UUID,
    payload: schemas.AmenityUpdate,
    svc: Svc = Depends(amenity_service),
) -> dict:
    return ok(
        schemas.AmenityRead.model_validate(svc.update_amenity(amenity_id, payload)),
        message="Updated",
    )


@router.get(
    "/{amenity_id}/slots", response_model=Envelope[list[schemas.SlotRead]], dependencies=[VIEW]
)
def list_slots(amenity_id: uuid.UUID, svc: Svc = Depends(amenity_service)) -> dict:
    return ok([schemas.SlotRead.model_validate(s) for s in svc.list_slots(amenity_id)])


@router.post(
    "/{amenity_id}/slots",
    response_model=Envelope[schemas.SlotRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
def create_slot(
    amenity_id: uuid.UUID, payload: schemas.SlotCreate, svc: Svc = Depends(amenity_service)
) -> dict:
    return ok(
        schemas.SlotRead.model_validate(svc.create_slot(amenity_id, payload)), message="Created"
    )


@router.delete(
    "/slots/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[APPROVE],
)
def delete_slot(slot_id: uuid.UUID, svc: Svc = Depends(amenity_service)) -> Response:
    svc.delete_slot(slot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{amenity_id}/rules", response_model=Envelope[list[schemas.RuleRead]], dependencies=[VIEW]
)
def list_rules(amenity_id: uuid.UUID, svc: Svc = Depends(amenity_service)) -> dict:
    return ok([schemas.RuleRead.model_validate(r) for r in svc.list_rules(amenity_id)])


@router.put(
    "/{amenity_id}/rules", response_model=Envelope[schemas.RuleRead], dependencies=[APPROVE]
)
def upsert_rule(
    amenity_id: uuid.UUID, payload: schemas.RuleUpsert, svc: Svc = Depends(amenity_service)
) -> dict:
    return ok(
        schemas.RuleRead.model_validate(svc.upsert_rule(amenity_id, payload)), message="Saved"
    )


@router.get(
    "/{amenity_id}/blocks", response_model=Envelope[list[schemas.BlockRead]], dependencies=[VIEW]
)
def list_blocks(amenity_id: uuid.UUID, svc: Svc = Depends(amenity_service)) -> dict:
    return ok([schemas.BlockRead.model_validate(b) for b in svc.list_blocks(amenity_id)])


@router.post(
    "/{amenity_id}/blocks",
    response_model=Envelope[schemas.BlockRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
def create_block(
    amenity_id: uuid.UUID, payload: schemas.BlockCreate, svc: Svc = Depends(amenity_service)
) -> dict:
    return ok(
        schemas.BlockRead.model_validate(svc.create_block(amenity_id, payload)),
        message="Blocked",
    )

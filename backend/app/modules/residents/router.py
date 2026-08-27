"""Residents API (FR-03). HTTP boundary only — see service.py for the rules.

Canonical envelope. RBAC: `residents:{view,create,update,delete}`.
Contract: docs/backend/api/residents.md.

Route order: static-prefix paths are declared before the `/{profile_id}` catch-all so
`GET /residents/move-records` isn't parsed as a profile id.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.residents import schemas
from app.modules.residents.deps import resident_service
from app.modules.residents.service import ResidentService

router = APIRouter(prefix="/residents", tags=["Residents"])

VIEW = Depends(require_permission("residents:view"))
CREATE = Depends(require_permission("residents:create"))
UPDATE = Depends(require_permission("residents:update"))
DELETE = Depends(require_permission("residents:delete"))


@router.get("/health", summary="Residents module liveness")
async def module_health() -> dict:
    return ok({"module": "residents", "status": "ok"})


# --- resident profiles: collection --------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.ResidentProfileRead]], dependencies=[VIEW])
def list_profiles(
    community_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = svc.list_profiles(
        community_id=community_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.ResidentProfileRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.ResidentProfileRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_profile(
    payload: schemas.ResidentProfileCreate,
    community_id: uuid.UUID | None = None,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    obj = svc.create_profile(payload, community_id=community_id)
    return ok(schemas.ResidentProfileRead.model_validate(obj), message="Resident profile created")


# --- occupancies (static prefixes first) ------------------------------ #
@router.get(
    "/units/{unit_id}/occupancies",
    response_model=Envelope[list[schemas.OccupancyRead]],
    dependencies=[VIEW],
)
def list_occupancies(
    unit_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = svc.list_occupancies(
        unit_id=unit_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.OccupancyRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get(
    "/units/{unit_id}/family-members",
    response_model=Envelope[list[schemas.FamilyMemberRead]],
    dependencies=[VIEW],
)
def list_family(
    unit_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = svc.list_family(unit_id=unit_id, offset=params.offset, limit=params.page_size)
    return paginated(
        [schemas.FamilyMemberRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/occupancies",
    response_model=Envelope[schemas.OccupancyRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_occupancy(
    payload: schemas.OccupancyCreate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(
        schemas.OccupancyRead.model_validate(svc.create_occupancy(payload)),
        message="Occupancy created",
    )


@router.patch(
    "/occupancies/{occupancy_id}/end",
    response_model=Envelope[schemas.OccupancyRead],
    dependencies=[UPDATE],
)
def end_occupancy(
    occupancy_id: uuid.UUID,
    payload: schemas.OccupancyEnd,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.OccupancyRead.model_validate(svc.end_occupancy(occupancy_id, payload)),
        message="Occupancy ended",
    )


# --- family members ------------------------------------------------ #
@router.post(
    "/family-members",
    response_model=Envelope[schemas.FamilyMemberRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_family(
    payload: schemas.FamilyMemberCreate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(
        schemas.FamilyMemberRead.model_validate(svc.create_family(payload)),
        message="Family member added",
    )


# --- emergency contacts (delete-by-id) --------------------------------- #
@router.delete(
    "/emergency-contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
def delete_contact(
    contact_id: uuid.UUID, svc: ResidentService = Depends(resident_service)
) -> Response:
    svc.delete_contact(contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- move records ------------------------------------------------- #
@router.get(
    "/move-records", response_model=Envelope[list[schemas.MoveRecordRead]], dependencies=[VIEW]
)
def list_moves(
    community_id: uuid.UUID | None = None,
    move_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = svc.list_moves(
        community_id=community_id, status=move_status, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.MoveRecordRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/move-records",
    response_model=Envelope[schemas.MoveRecordRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_move(
    payload: schemas.MoveRecordCreate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(
        schemas.MoveRecordRead.model_validate(svc.create_move(payload)),
        message="Move record created",
    )


@router.get(
    "/move-records/{move_id}", response_model=Envelope[schemas.MoveRecordRead], dependencies=[VIEW]
)
def get_move(move_id: uuid.UUID, svc: ResidentService = Depends(resident_service)) -> dict:
    return ok(schemas.MoveRecordRead.model_validate(svc.get_move(move_id)))


@router.patch(
    "/move-records/{move_id}/status",
    response_model=Envelope[schemas.MoveRecordRead],
    dependencies=[UPDATE],
)
def transition_move(
    move_id: uuid.UUID,
    payload: schemas.MoveRecordTransition,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.MoveRecordRead.model_validate(svc.transition_move(move_id, payload)),
        message="Updated",
    )


# --- resident profile by id (catch-all — declared last) --------------- #
@router.get(
    "/{profile_id}", response_model=Envelope[schemas.ResidentProfileRead], dependencies=[VIEW]
)
def get_profile(profile_id: uuid.UUID, svc: ResidentService = Depends(resident_service)) -> dict:
    return ok(schemas.ResidentProfileRead.model_validate(svc.get_profile(profile_id)))


@router.patch(
    "/{profile_id}", response_model=Envelope[schemas.ResidentProfileRead], dependencies=[UPDATE]
)
def update_profile(
    profile_id: uuid.UUID,
    payload: schemas.ResidentProfileUpdate,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.ResidentProfileRead.model_validate(svc.update_profile(profile_id, payload)),
        message="Updated",
    )


@router.get(
    "/{profile_id}/emergency-contacts",
    response_model=Envelope[list[schemas.EmergencyContactRead]],
    dependencies=[VIEW],
)
def list_contacts(
    profile_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = svc.list_contacts(
        profile_id=profile_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.EmergencyContactRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/{profile_id}/emergency-contacts",
    response_model=Envelope[schemas.EmergencyContactRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_contact(
    profile_id: uuid.UUID,
    payload: schemas.EmergencyContactCreate,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.EmergencyContactRead.model_validate(svc.create_contact(profile_id, payload)),
        message="Contact added",
    )

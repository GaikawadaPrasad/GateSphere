"""Community & Property API (FR-03). HTTP boundary only — see service.py for the rules.

All responses use the canonical envelope. RBAC: `communities:{view,create,update,delete}`.
Contract: docs/backend/api/communities.md. Async stack (ADR-010).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.communities import schemas
from app.modules.communities.deps import community_service
from app.modules.communities.service import CommunityService

router = APIRouter(prefix="/communities", tags=["Community & Property"])

VIEW = Depends(require_permission_async("communities:view"))
CREATE = Depends(require_permission_async("communities:create"))
UPDATE = Depends(require_permission_async("communities:update"))
DELETE = Depends(require_permission_async("communities:delete"))


@router.get("/health", summary="Community & Property module liveness")
async def module_health() -> dict:
    return ok({"module": "communities", "status": "ok"})


# --- communities --------------------------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.CommunityRead]], dependencies=[VIEW])
async def list_communities(
    active: bool | None = None,
    params: PageParams = Depends(page_params),
    svc: CommunityService = Depends(community_service),
) -> dict:
    rows, total = await svc.list_communities(
        offset=params.offset, limit=params.page_size, active=active
    )
    return paginated(
        [schemas.CommunityRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.CommunityRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_community(
    payload: schemas.CommunityCreate, svc: CommunityService = Depends(community_service)
) -> dict:
    obj = await svc.create_community(payload)
    return ok(schemas.CommunityRead.model_validate(obj), message="Community created")


@router.get("/{community_id}", response_model=Envelope[schemas.CommunityRead], dependencies=[VIEW])
async def get_community(
    community_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> dict:
    return ok(schemas.CommunityRead.model_validate(await svc.get_community(community_id)))


@router.patch(
    "/{community_id}", response_model=Envelope[schemas.CommunityRead], dependencies=[UPDATE]
)
async def update_community(
    community_id: uuid.UUID,
    payload: schemas.CommunityUpdate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    return ok(
        schemas.CommunityRead.model_validate(await svc.update_community(community_id, payload)),
        message="Updated",
    )


@router.delete(
    "/{community_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_community(
    community_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> Response:
    await svc.delete_community(community_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- gates ------------------------------------------------------------- #
@router.get(
    "/{community_id}/gates", response_model=Envelope[list[schemas.GateRead]], dependencies=[VIEW]
)
async def list_gates(
    community_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: CommunityService = Depends(community_service),
) -> dict:
    rows, total = await svc.list_gates(
        community_id=community_id, offset=params.offset, limit=params.page_size
    )
    return paginated([schemas.GateRead.model_validate(r) for r in rows], total=total, params=params)


@router.post(
    "/{community_id}/gates",
    response_model=Envelope[schemas.GateRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_gate(
    community_id: uuid.UUID,
    payload: schemas.GateCreate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    obj = await svc.create_gate(community_id=community_id, payload=payload)
    return ok(schemas.GateRead.model_validate(obj), message="Gate created")


@router.get("/gates/{gate_id}", response_model=Envelope[schemas.GateRead], dependencies=[VIEW])
async def get_gate(gate_id: uuid.UUID, svc: CommunityService = Depends(community_service)) -> dict:
    return ok(schemas.GateRead.model_validate(await svc.get_gate(gate_id)))


@router.patch("/gates/{gate_id}", response_model=Envelope[schemas.GateRead], dependencies=[UPDATE])
async def update_gate(
    gate_id: uuid.UUID,
    payload: schemas.GateUpdate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    return ok(
        schemas.GateRead.model_validate(await svc.update_gate(gate_id, payload)),
        message="Updated",
    )


@router.delete(
    "/gates/{gate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_gate(
    gate_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> Response:
    await svc.delete_gate(gate_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- towers ---------------------------------------------------------- #
@router.get(
    "/{community_id}/towers", response_model=Envelope[list[schemas.TowerRead]], dependencies=[VIEW]
)
async def list_towers(
    community_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: CommunityService = Depends(community_service),
) -> dict:
    rows, total = await svc.list_towers(
        community_id=community_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.TowerRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/{community_id}/towers",
    response_model=Envelope[schemas.TowerRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_tower(
    community_id: uuid.UUID,
    payload: schemas.TowerCreate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    obj = await svc.create_tower(community_id=community_id, payload=payload)
    return ok(schemas.TowerRead.model_validate(obj), message="Tower created")


@router.get("/towers/{tower_id}", response_model=Envelope[schemas.TowerRead], dependencies=[VIEW])
async def get_tower(
    tower_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> dict:
    return ok(schemas.TowerRead.model_validate(await svc.get_tower(tower_id)))


@router.patch(
    "/towers/{tower_id}", response_model=Envelope[schemas.TowerRead], dependencies=[UPDATE]
)
async def update_tower(
    tower_id: uuid.UUID,
    payload: schemas.TowerUpdate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    return ok(
        schemas.TowerRead.model_validate(await svc.update_tower(tower_id, payload)),
        message="Updated",
    )


@router.delete(
    "/towers/{tower_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_tower(
    tower_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> Response:
    await svc.delete_tower(tower_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- floors -------------------------------------------------------- #
@router.get(
    "/towers/{tower_id}/floors",
    response_model=Envelope[list[schemas.FloorRead]],
    dependencies=[VIEW],
)
async def list_floors(
    tower_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: CommunityService = Depends(community_service),
) -> dict:
    rows, total = await svc.list_floors(
        tower_id=tower_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.FloorRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/floors",
    response_model=Envelope[schemas.FloorRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_floor(
    payload: schemas.FloorCreate, svc: CommunityService = Depends(community_service)
) -> dict:
    return ok(
        schemas.FloorRead.model_validate(await svc.create_floor(payload)), message="Floor created"
    )


@router.get("/floors/{floor_id}", response_model=Envelope[schemas.FloorRead], dependencies=[VIEW])
async def get_floor(
    floor_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> dict:
    return ok(schemas.FloorRead.model_validate(await svc.get_floor(floor_id)))


@router.patch(
    "/floors/{floor_id}", response_model=Envelope[schemas.FloorRead], dependencies=[UPDATE]
)
async def update_floor(
    floor_id: uuid.UUID,
    payload: schemas.FloorUpdate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    return ok(
        schemas.FloorRead.model_validate(await svc.update_floor(floor_id, payload)),
        message="Updated",
    )


@router.delete(
    "/floors/{floor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_floor(
    floor_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> Response:
    await svc.delete_floor(floor_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- units ------------------------------------------------------- #
@router.get(
    "/{community_id}/units",
    response_model=Envelope[list[schemas.UnitRead]],
    dependencies=[VIEW],
)
async def list_community_units(
    community_id: uuid.UUID,
    tower_id: uuid.UUID | None = None,
    floor_id: uuid.UUID | None = None,
    unit_type: str | None = None,
    active: bool | None = None,
    params: PageParams = Depends(page_params),
    svc: CommunityService = Depends(community_service),
) -> dict:
    rows, total = await svc.list_community_units(
        community_id=community_id,
        offset=params.offset,
        limit=params.page_size,
        tower_id=tower_id,
        floor_id=floor_id,
        unit_type=unit_type,
        active=active,
    )
    return paginated([schemas.UnitRead.model_validate(r) for r in rows], total=total, params=params)


@router.get(
    "/floors/{floor_id}/units", response_model=Envelope[list[schemas.UnitRead]], dependencies=[VIEW]
)
async def list_units(
    floor_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: CommunityService = Depends(community_service),
) -> dict:
    rows, total = await svc.list_units(
        floor_id=floor_id, offset=params.offset, limit=params.page_size
    )
    return paginated([schemas.UnitRead.model_validate(r) for r in rows], total=total, params=params)


@router.post(
    "/units",
    response_model=Envelope[schemas.UnitRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_unit(
    payload: schemas.UnitCreate, svc: CommunityService = Depends(community_service)
) -> dict:
    return ok(
        schemas.UnitRead.model_validate(await svc.create_unit(payload)), message="Unit created"
    )


@router.get("/units/{unit_id}", response_model=Envelope[schemas.UnitRead], dependencies=[VIEW])
async def get_unit(unit_id: uuid.UUID, svc: CommunityService = Depends(community_service)) -> dict:
    return ok(schemas.UnitRead.model_validate(await svc.get_unit(unit_id)))


@router.patch("/units/{unit_id}", response_model=Envelope[schemas.UnitRead], dependencies=[UPDATE])
async def update_unit(
    unit_id: uuid.UUID,
    payload: schemas.UnitUpdate,
    svc: CommunityService = Depends(community_service),
) -> dict:
    return ok(
        schemas.UnitRead.model_validate(await svc.update_unit(unit_id, payload)), message="Updated"
    )


@router.delete(
    "/units/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_unit(
    unit_id: uuid.UUID, svc: CommunityService = Depends(community_service)
) -> Response:
    await svc.delete_unit(unit_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Visitor Management API (FR-04). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `visitors:{view,create,approve,update}`.
Contract: docs/backend/api/visitors.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.visitors import schemas
from app.modules.visitors.deps import visitor_service
from app.modules.visitors.service import VisitorService

router = APIRouter(prefix="/visitors", tags=["Visitor Management"])

VIEW = Depends(require_permission("visitors:view"))
CREATE = Depends(require_permission("visitors:create"))
APPROVE = Depends(require_permission("visitors:approve"))
UPDATE = Depends(require_permission("visitors:update"))


@router.get("/health", summary="Visitor Management module liveness")
async def module_health() -> dict:
    return ok({"module": "visitors", "status": "ok"})


# --- policy ------------------------------------------------------------- #
@router.get("/policy", response_model=Envelope[schemas.PolicyRead], dependencies=[VIEW])
def get_policy(
    community_id: uuid.UUID | None = None, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(schemas.PolicyRead.model_validate(svc.get_policy(community_id=community_id)))


@router.patch("/policy", response_model=Envelope[schemas.PolicyRead], dependencies=[UPDATE])
def update_policy(
    payload: schemas.PolicyUpdate,
    community_id: uuid.UUID | None = None,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.PolicyRead.model_validate(svc.update_policy(payload, community_id=community_id)),
        message="Updated",
    )


# --- blacklist -------------------------------------------------------- #
@router.get("/blacklist", response_model=Envelope[list[schemas.BlacklistRead]], dependencies=[VIEW])
def list_blacklist(
    community_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = svc.list_blacklist(
        community_id=community_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.BlacklistRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/blacklist",
    response_model=Envelope[schemas.BlacklistRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
def add_blacklist(
    payload: schemas.BlacklistCreate,
    community_id: uuid.UUID | None = None,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.BlacklistRead.model_validate(svc.add_blacklist(payload, community_id=community_id)),
        message="Blacklisted",
    )


# --- entries -------------------------------------------------------- #
@router.get("/entries", response_model=Envelope[list[schemas.EntryRead]], dependencies=[VIEW])
def list_entries(
    community_id: uuid.UUID | None = None,
    entry_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = svc.list_entries(
        community_id=community_id, status=entry_status, offset=params.offset, limit=params.page_size
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
    payload: schemas.EntryCreate, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(schemas.EntryRead.model_validate(svc.record_entry(payload)), message="Entry recorded")


@router.patch(
    "/entries/{entry_id}/exit", response_model=Envelope[schemas.EntryRead], dependencies=[UPDATE]
)
def record_exit(entry_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)) -> dict:
    return ok(schemas.EntryRead.model_validate(svc.record_exit(entry_id)), message="Exit recorded")


# --- requests ------------------------------------------------------ #
@router.get("/requests", response_model=Envelope[list[schemas.RequestRead]], dependencies=[VIEW])
def list_requests(
    community_id: uuid.UUID | None = None,
    request_status: str | None = None,
    unit_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = svc.list_requests(
        community_id=community_id,
        status=request_status,
        unit_id=unit_id,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.RequestRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/requests",
    response_model=Envelope[schemas.RequestRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_request(
    payload: schemas.RequestCreate, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(
        schemas.RequestRead.model_validate(svc.create_request(payload)), message="Request created"
    )


@router.get(
    "/requests/{request_id}", response_model=Envelope[schemas.RequestRead], dependencies=[VIEW]
)
def get_request(request_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)) -> dict:
    return ok(schemas.RequestRead.model_validate(svc.get_request(request_id)))


@router.post(
    "/requests/{request_id}/decision",
    response_model=Envelope[schemas.RequestRead],
    dependencies=[APPROVE],
)
def decide_request(
    request_id: uuid.UUID,
    payload: schemas.RequestDecision,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.RequestRead.model_validate(svc.decide_request(request_id, payload)),
        message="Decision recorded",
    )


@router.post(
    "/requests/{request_id}/cancel",
    response_model=Envelope[schemas.RequestRead],
    dependencies=[UPDATE],
)
def cancel_request(request_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)) -> dict:
    return ok(
        schemas.RequestRead.model_validate(svc.cancel_request(request_id)), message="Cancelled"
    )


@router.post(
    "/requests/{request_id}/passes",
    response_model=Envelope[schemas.PassRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_pass(
    request_id: uuid.UUID,
    payload: schemas.PassCreate,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    obj, token = svc.create_pass(request_id, payload)
    read = schemas.PassRead.model_validate(obj)
    read.token = token
    return ok(read, message="Pass issued — the token is shown once")


@router.post(
    "/passes/{pass_id}/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[UPDATE],
)
def revoke_pass(pass_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)) -> Response:
    svc.revoke_pass(pass_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- visitors (directory) ---------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.VisitorRead]], dependencies=[VIEW])
def list_visitors(
    community_id: uuid.UUID | None = None,
    q: str | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = svc.list_visitors(
        community_id=community_id, q=q, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.VisitorRead.model_validate(r) for r in rows], total=total, params=params
    )

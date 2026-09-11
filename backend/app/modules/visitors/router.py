"""Visitor Management API (FR-04). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `visitors:{view,create,approve,update}`.
Contract: docs/backend/api/visitors.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.export import EXPORT_ROW_CAP, csv_response
from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.visitors import schemas
from app.modules.visitors.deps import visitor_service
from app.modules.visitors.service import VisitorService

router = APIRouter(prefix="/visitors", tags=["Visitor Management"])

VIEW = Depends(require_permission_async("visitors:view"))
CREATE = Depends(require_permission_async("visitors:create"))
APPROVE = Depends(require_permission_async("visitors:approve"))
UPDATE = Depends(require_permission_async("visitors:update"))
EXPORT = Depends(require_permission_async("visitors:export"))


@router.get("/health", summary="Visitor Management module liveness")
async def module_health() -> dict:
    return ok({"module": "visitors", "status": "ok"})


# --- policy ------------------------------------------------------------- #
@router.get("/policy", response_model=Envelope[schemas.PolicyRead], dependencies=[VIEW])
async def get_policy(
    community_id: uuid.UUID | None = None, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(schemas.PolicyRead.model_validate(await svc.get_policy(community_id=community_id)))


@router.patch("/policy", response_model=Envelope[schemas.PolicyRead], dependencies=[UPDATE])
async def update_policy(
    payload: schemas.PolicyUpdate,
    community_id: uuid.UUID | None = None,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.PolicyRead.model_validate(
            await svc.update_policy(payload, community_id=community_id)
        ),
        message="Updated",
    )


# --- blacklist -------------------------------------------------------- #
@router.get("/blacklist", response_model=Envelope[list[schemas.BlacklistRead]], dependencies=[VIEW])
async def list_blacklist(
    community_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = await svc.list_blacklist(
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
async def add_blacklist(
    payload: schemas.BlacklistCreate,
    community_id: uuid.UUID | None = None,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.BlacklistRead.model_validate(
            await svc.add_blacklist(payload, community_id=community_id)
        ),
        message="Blacklisted",
    )


# --- entries -------------------------------------------------------- #
@router.get("/entries", response_model=Envelope[list[schemas.EntryRead]], dependencies=[VIEW])
async def list_entries(
    community_id: uuid.UUID | None = None,
    entry_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = await svc.list_entries(
        community_id=community_id, status=entry_status, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.EntryRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get("/entries.csv", dependencies=[EXPORT])
@router.get("/entries/export", dependencies=[EXPORT])
async def export_entries(
    community_id: uuid.UUID | None = None,
    entry_status: str | None = None,
    svc: VisitorService = Depends(visitor_service),
):
    rows, _ = await svc.list_entries(
        community_id=community_id,
        status=entry_status,
        offset=0,
        limit=EXPORT_ROW_CAP,
    )
    return csv_response(
        "visitor_entries.csv",
        ["entry_at", "exit_at", "status", "visitor_id", "request_id", "vehicle_number"],
        (
            (e.entry_at, e.exit_at, e.status, e.visitor_id, e.request_id, e.vehicle_number)
            for e in rows
        ),
    )


@router.post(
    "/entries",
    response_model=Envelope[schemas.EntryRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def record_entry(
    payload: schemas.EntryCreate, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(
        schemas.EntryRead.model_validate(await svc.record_entry(payload)), message="Entry recorded"
    )


@router.patch(
    "/entries/{entry_id}/exit", response_model=Envelope[schemas.EntryRead], dependencies=[UPDATE]
)
async def record_exit(entry_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)) -> dict:
    return ok(
        schemas.EntryRead.model_validate(await svc.record_exit(entry_id)), message="Exit recorded"
    )


# --- requests ------------------------------------------------------ #
@router.get("/requests", response_model=Envelope[list[schemas.RequestRead]], dependencies=[VIEW])
async def list_requests(
    community_id: uuid.UUID | None = None,
    request_status: str | None = None,
    unit_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = await svc.list_requests(
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
async def create_request(
    payload: schemas.RequestCreate, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(
        schemas.RequestRead.model_validate(await svc.create_request(payload)),
        message="Request created",
    )


@router.get(
    "/requests/{request_id}", response_model=Envelope[schemas.RequestRead], dependencies=[VIEW]
)
async def get_request(
    request_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(schemas.RequestRead.model_validate(await svc.get_request(request_id)))


@router.post(
    "/requests/{request_id}/decision",
    response_model=Envelope[schemas.RequestRead],
    dependencies=[APPROVE],
)
async def decide_request(
    request_id: uuid.UUID,
    payload: schemas.RequestDecision,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.RequestRead.model_validate(await svc.decide_request(request_id, payload)),
        message="Decision recorded",
    )


@router.post(
    "/requests/{request_id}/cancel",
    response_model=Envelope[schemas.RequestRead],
    dependencies=[UPDATE],
)
async def cancel_request(
    request_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(
        schemas.RequestRead.model_validate(await svc.cancel_request(request_id)),
        message="Cancelled",
    )


@router.post(
    "/requests/{request_id}/passes",
    response_model=Envelope[schemas.PassRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_pass(
    request_id: uuid.UUID,
    payload: schemas.PassCreate,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    obj, token, pin = await svc.create_pass(request_id, payload)
    read = schemas.PassRead.model_validate(obj)
    read.token = token
    read.pin = pin
    return ok(read, message="Pass issued — the token/PIN are shown once")


@router.get(
    "/requests/{request_id}/members",
    response_model=Envelope[list[schemas.GroupMemberRead]],
    dependencies=[VIEW],
)
async def list_group_members(
    request_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)
) -> dict:
    return ok(
        [
            schemas.GroupMemberRead.model_validate(m)
            for m in await svc.list_group_members(request_id)
        ]
    )


@router.post(
    "/requests/{request_id}/members",
    response_model=Envelope[schemas.GroupMemberRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def add_group_member(
    request_id: uuid.UUID,
    payload: schemas.GroupMemberCreate,
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    return ok(
        schemas.GroupMemberRead.model_validate(await svc.add_group_member(request_id, payload)),
        message="Visitor added to the group",
    )


@router.post(
    "/passes/{pass_id}/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[UPDATE],
)
async def revoke_pass(
    pass_id: uuid.UUID, svc: VisitorService = Depends(visitor_service)
) -> Response:
    await svc.revoke_pass(pass_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- visitors (directory) ---------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.VisitorRead]], dependencies=[VIEW])
async def list_visitors(
    community_id: uuid.UUID | None = None,
    q: str | None = None,
    params: PageParams = Depends(page_params),
    svc: VisitorService = Depends(visitor_service),
) -> dict:
    rows, total = await svc.list_visitors(
        community_id=community_id, q=q, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.VisitorRead.model_validate(r) for r in rows], total=total, params=params
    )

"""Complaint & Service Desk API (FR-10). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `complaints:{view,create,update,approve}`.
Contract: docs/backend/api/complaints.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission_async
from app.modules.complaints import schemas
from app.modules.complaints.deps import complaint_service
from app.modules.complaints.service import ComplaintService

router = APIRouter(prefix="/complaints", tags=["Complaint & Service Desk"])

VIEW = Depends(require_permission_async("complaints:view"))
CREATE = Depends(require_permission_async("complaints:create"))
UPDATE = Depends(require_permission_async("complaints:update"))
APPROVE = Depends(require_permission_async("complaints:approve"))

Svc = ComplaintService


@router.get("/health", summary="Complaint & Service Desk module liveness")
async def module_health() -> dict:
    return ok({"module": "complaints", "status": "ok"})


# --- categories --------------------------------------------------- #
@router.get("/categories", response_model=Envelope[list[schemas.CategoryRead]], dependencies=[VIEW])
async def list_categories(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(complaint_service)
) -> dict:
    return ok(
        [
            schemas.CategoryRead.model_validate(r)
            for r in await svc.list_categories(community_id=community_id)
        ]
    )


@router.post(
    "/categories",
    response_model=Envelope[schemas.CategoryRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
async def create_category(
    payload: schemas.CategoryCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.CategoryRead.model_validate(
            await svc.create_category(payload, community_id=community_id)
        ),
        message="Created",
    )


@router.patch(
    "/categories/{category_id}",
    response_model=Envelope[schemas.CategoryRead],
    dependencies=[APPROVE],
)
async def update_category(
    category_id: uuid.UUID,
    payload: schemas.CategoryUpdate,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.CategoryRead.model_validate(await svc.update_category(category_id, payload)),
        message="Updated",
    )


# --- SLA policies ----------------------------------------------- #
@router.get("/sla", response_model=Envelope[list[schemas.SlaRead]], dependencies=[VIEW])
async def list_slas(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(complaint_service)
) -> dict:
    return ok(
        [schemas.SlaRead.model_validate(r) for r in await svc.list_slas(community_id=community_id)]
    )


@router.put("/sla", response_model=Envelope[schemas.SlaRead], dependencies=[APPROVE])
async def upsert_sla(
    payload: schemas.SlaCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.SlaRead.model_validate(await svc.upsert_sla(payload, community_id=community_id)),
        message="Saved",
    )


# --- tickets -------------------------------------------------- #
@router.get("/tickets", response_model=Envelope[list[schemas.TicketRead]], dependencies=[VIEW])
async def list_tickets(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    ticket_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(complaint_service),
) -> dict:
    rows, total = await svc.list_tickets(
        community_id=community_id,
        unit_id=unit_id,
        ticket_status=ticket_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.TicketRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/tickets",
    response_model=Envelope[schemas.TicketRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_ticket(
    payload: schemas.TicketCreate, svc: Svc = Depends(complaint_service)
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(await svc.create_ticket(payload)),
        message="Ticket created",
    )


@router.get(
    "/tickets/{ticket_id}", response_model=Envelope[schemas.TicketRead], dependencies=[VIEW]
)
async def get_ticket(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok(schemas.TicketRead.model_validate(await svc.get_ticket(ticket_id)))


@router.get(
    "/tickets/{ticket_id}/history",
    response_model=Envelope[list[schemas.HistoryRead]],
    dependencies=[VIEW],
)
async def ticket_history(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok([schemas.HistoryRead.model_validate(h) for h in await svc.list_history(ticket_id)])


@router.get(
    "/tickets/{ticket_id}/messages",
    response_model=Envelope[list[schemas.MessageRead]],
    dependencies=[VIEW],
)
async def ticket_messages(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok([schemas.MessageRead.model_validate(m) for m in await svc.list_messages(ticket_id)])


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=Envelope[schemas.MessageRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
async def add_message(
    ticket_id: uuid.UUID,
    payload: schemas.MessageCreate,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.MessageRead.model_validate(await svc.add_message(ticket_id, payload)),
        message="Sent",
    )


@router.post(
    "/tickets/{ticket_id}/assign",
    response_model=Envelope[schemas.TicketRead],
    dependencies=[UPDATE],
)
async def assign_ticket(
    ticket_id: uuid.UUID,
    payload: schemas.TicketAssign,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(await svc.assign_ticket(ticket_id, payload)),
        message="Assigned",
    )


@router.post(
    "/tickets/{ticket_id}/transition",
    response_model=Envelope[schemas.TicketRead],
    dependencies=[UPDATE],
)
async def transition_ticket(
    ticket_id: uuid.UUID,
    payload: schemas.TicketTransition,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(await svc.transition_ticket(ticket_id, payload)),
        message="Updated",
    )


@router.post(
    "/tickets/{ticket_id}/confirm",
    response_model=Envelope[schemas.TicketRead],
    dependencies=[VIEW],
)
async def confirm_ticket(
    ticket_id: uuid.UUID,
    payload: schemas.TicketConfirm,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(await svc.confirm_ticket(ticket_id, payload)),
        message="Recorded",
    )


@router.post(
    "/tickets/{ticket_id}/feedback",
    response_model=Envelope[schemas.FeedbackRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
async def add_feedback(
    ticket_id: uuid.UUID,
    payload: schemas.FeedbackCreate,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.FeedbackRead.model_validate(await svc.add_feedback(ticket_id, payload)),
        message="Thanks",
    )


@router.get(
    "/tickets/{ticket_id}/attachments",
    response_model=Envelope[list[schemas.AttachmentRead]],
    dependencies=[VIEW],
)
async def list_attachments(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok(
        [schemas.AttachmentRead.model_validate(a) for a in await svc.list_attachments(ticket_id)]
    )


@router.post(
    "/tickets/{ticket_id}/attachments",
    response_model=Envelope[schemas.AttachmentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
async def add_attachment(
    ticket_id: uuid.UUID,
    payload: schemas.AttachmentIn,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.AttachmentRead.model_validate(await svc.add_attachment(ticket_id, payload)),
        message="Attached",
    )

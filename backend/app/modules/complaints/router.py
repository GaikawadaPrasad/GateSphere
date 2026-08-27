"""Complaint & Service Desk API (FR-10). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `complaints:{view,create,update,approve}`.
Contract: docs/backend/api/complaints.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.complaints import schemas
from app.modules.complaints.deps import complaint_service
from app.modules.complaints.service import ComplaintService

router = APIRouter(prefix="/complaints", tags=["Complaint & Service Desk"])

VIEW = Depends(require_permission("complaints:view"))
CREATE = Depends(require_permission("complaints:create"))
UPDATE = Depends(require_permission("complaints:update"))
APPROVE = Depends(require_permission("complaints:approve"))

Svc = ComplaintService


@router.get("/health", summary="Complaint & Service Desk module liveness")
async def module_health() -> dict:
    return ok({"module": "complaints", "status": "ok"})


# --- categories --------------------------------------------------- #
@router.get("/categories", response_model=Envelope[list[schemas.CategoryRead]], dependencies=[VIEW])
def list_categories(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(complaint_service)
) -> dict:
    return ok(
        [
            schemas.CategoryRead.model_validate(r)
            for r in svc.list_categories(community_id=community_id)
        ]
    )


@router.post(
    "/categories",
    response_model=Envelope[schemas.CategoryRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
def create_category(
    payload: schemas.CategoryCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.CategoryRead.model_validate(
            svc.create_category(payload, community_id=community_id)
        ),
        message="Created",
    )


@router.patch(
    "/categories/{category_id}",
    response_model=Envelope[schemas.CategoryRead],
    dependencies=[APPROVE],
)
def update_category(
    category_id: uuid.UUID,
    payload: schemas.CategoryUpdate,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.CategoryRead.model_validate(svc.update_category(category_id, payload)),
        message="Updated",
    )


# --- SLA policies ----------------------------------------------- #
@router.get("/sla", response_model=Envelope[list[schemas.SlaRead]], dependencies=[VIEW])
def list_slas(community_id: uuid.UUID | None = None, svc: Svc = Depends(complaint_service)) -> dict:
    return ok([schemas.SlaRead.model_validate(r) for r in svc.list_slas(community_id=community_id)])


@router.put("/sla", response_model=Envelope[schemas.SlaRead], dependencies=[APPROVE])
def upsert_sla(
    payload: schemas.SlaCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.SlaRead.model_validate(svc.upsert_sla(payload, community_id=community_id)),
        message="Saved",
    )


# --- tickets -------------------------------------------------- #
@router.get("/tickets", response_model=Envelope[list[schemas.TicketRead]], dependencies=[VIEW])
def list_tickets(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    ticket_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(complaint_service),
) -> dict:
    rows, total = svc.list_tickets(
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
def create_ticket(payload: schemas.TicketCreate, svc: Svc = Depends(complaint_service)) -> dict:
    return ok(
        schemas.TicketRead.model_validate(svc.create_ticket(payload)), message="Ticket created"
    )


@router.get(
    "/tickets/{ticket_id}", response_model=Envelope[schemas.TicketRead], dependencies=[VIEW]
)
def get_ticket(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok(schemas.TicketRead.model_validate(svc.get_ticket(ticket_id)))


@router.get(
    "/tickets/{ticket_id}/history",
    response_model=Envelope[list[schemas.HistoryRead]],
    dependencies=[VIEW],
)
def ticket_history(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok([schemas.HistoryRead.model_validate(h) for h in svc.list_history(ticket_id)])


@router.get(
    "/tickets/{ticket_id}/messages",
    response_model=Envelope[list[schemas.MessageRead]],
    dependencies=[VIEW],
)
def ticket_messages(ticket_id: uuid.UUID, svc: Svc = Depends(complaint_service)) -> dict:
    return ok([schemas.MessageRead.model_validate(m) for m in svc.list_messages(ticket_id)])


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=Envelope[schemas.MessageRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
def add_message(
    ticket_id: uuid.UUID,
    payload: schemas.MessageCreate,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.MessageRead.model_validate(svc.add_message(ticket_id, payload)), message="Sent"
    )


@router.post(
    "/tickets/{ticket_id}/assign",
    response_model=Envelope[schemas.TicketRead],
    dependencies=[UPDATE],
)
def assign_ticket(
    ticket_id: uuid.UUID,
    payload: schemas.TicketAssign,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(svc.assign_ticket(ticket_id, payload)),
        message="Assigned",
    )


@router.post(
    "/tickets/{ticket_id}/transition",
    response_model=Envelope[schemas.TicketRead],
    dependencies=[UPDATE],
)
def transition_ticket(
    ticket_id: uuid.UUID,
    payload: schemas.TicketTransition,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(svc.transition_ticket(ticket_id, payload)),
        message="Updated",
    )


@router.post(
    "/tickets/{ticket_id}/confirm",
    response_model=Envelope[schemas.TicketRead],
    dependencies=[VIEW],
)
def confirm_ticket(
    ticket_id: uuid.UUID,
    payload: schemas.TicketConfirm,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.TicketRead.model_validate(svc.confirm_ticket(ticket_id, payload)),
        message="Recorded",
    )


@router.post(
    "/tickets/{ticket_id}/feedback",
    response_model=Envelope[schemas.FeedbackRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
def add_feedback(
    ticket_id: uuid.UUID,
    payload: schemas.FeedbackCreate,
    svc: Svc = Depends(complaint_service),
) -> dict:
    return ok(
        schemas.FeedbackRead.model_validate(svc.add_feedback(ticket_id, payload)),
        message="Thanks",
    )

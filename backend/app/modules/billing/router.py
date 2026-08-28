"""Maintenance & Billing API (FR-09). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `billing:{view,create,update,approve,export}`.
Contract: docs/backend/api/billing.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.billing import schemas
from app.modules.billing.deps import billing_service
from app.modules.billing.service import BillingService

router = APIRouter(prefix="/billing", tags=["Maintenance & Billing"])

VIEW = Depends(require_permission("billing:view"))
CREATE = Depends(require_permission("billing:create"))
UPDATE = Depends(require_permission("billing:update"))
APPROVE = Depends(require_permission("billing:approve"))

Svc = BillingService


@router.get("/health", summary="Maintenance & Billing module liveness")
async def module_health() -> dict:
    return ok({"module": "billing", "status": "ok"})


# --- charge heads --------------------------------------------------- #
@router.get(
    "/charge-heads", response_model=Envelope[list[schemas.ChargeHeadRead]], dependencies=[VIEW]
)
def list_charge_heads(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(billing_service)
) -> dict:
    return ok(
        [
            schemas.ChargeHeadRead.model_validate(r)
            for r in svc.list_charge_heads(community_id=community_id)
        ]
    )


@router.post(
    "/charge-heads",
    response_model=Envelope[schemas.ChargeHeadRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
def create_charge_head(
    payload: schemas.ChargeHeadCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(billing_service),
) -> dict:
    return ok(
        schemas.ChargeHeadRead.model_validate(
            svc.create_charge_head(payload, community_id=community_id)
        ),
        message="Created",
    )


@router.patch(
    "/charge-heads/{charge_head_id}",
    response_model=Envelope[schemas.ChargeHeadRead],
    dependencies=[APPROVE],
)
def update_charge_head(
    charge_head_id: uuid.UUID,
    payload: schemas.ChargeHeadUpdate,
    svc: Svc = Depends(billing_service),
) -> dict:
    return ok(
        schemas.ChargeHeadRead.model_validate(svc.update_charge_head(charge_head_id, payload)),
        message="Updated",
    )


# --- billing rules ---------------------------------------------- #
@router.get("/rules", response_model=Envelope[schemas.RuleRead], dependencies=[VIEW])
def get_rule(community_id: uuid.UUID | None = None, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.RuleRead.model_validate(svc.get_rule(community_id=community_id)))


@router.patch("/rules", response_model=Envelope[schemas.RuleRead], dependencies=[APPROVE])
def update_rule(
    payload: schemas.RuleUpdate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(billing_service),
) -> dict:
    return ok(
        schemas.RuleRead.model_validate(svc.update_rule(payload, community_id=community_id)),
        message="Updated",
    )


# --- payments ------------------------------------------------- #
@router.get("/payments", response_model=Envelope[list[schemas.PaymentRead]], dependencies=[VIEW])
def list_payments(
    community_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(billing_service),
) -> dict:
    rows, total = svc.list_payments(
        community_id=community_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.PaymentRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/payments",
    response_model=Envelope[schemas.PaymentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def record_payment(payload: schemas.PaymentCreate, svc: Svc = Depends(billing_service)) -> dict:
    return ok(
        schemas.PaymentRead.model_validate(svc.record_payment(payload)),
        message="Payment recorded",
    )


@router.get(
    "/payments/{payment_id}", response_model=Envelope[schemas.PaymentRead], dependencies=[VIEW]
)
def get_payment(payment_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.PaymentRead.model_validate(svc.get_payment(payment_id)))


@router.get(
    "/payments/{payment_id}/receipt",
    response_model=Envelope[schemas.ReceiptRead],
    dependencies=[VIEW],
)
def get_payment_receipt(payment_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.ReceiptRead.model_validate(svc.get_receipt(payment_id)))


# --- ledger ------------------------------------------------- #
@router.get(
    "/units/{unit_id}/ledger",
    response_model=Envelope[list[schemas.LedgerRead]],
    dependencies=[VIEW],
)
def unit_ledger(
    unit_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(billing_service),
) -> dict:
    rows, total = svc.unit_ledger(unit_id, offset=params.offset, limit=params.page_size)
    return paginated(
        [schemas.LedgerRead.model_validate(r) for r in rows], total=total, params=params
    )


# --- invoices --------------------------------------------- #
@router.get("/invoices", response_model=Envelope[list[schemas.InvoiceRead]], dependencies=[VIEW])
def list_invoices(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    invoice_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(billing_service),
) -> dict:
    rows, total = svc.list_invoices(
        community_id=community_id,
        unit_id=unit_id,
        invoice_status=invoice_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.InvoiceRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/invoices",
    response_model=Envelope[schemas.InvoiceRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_invoice(payload: schemas.InvoiceCreate, svc: Svc = Depends(billing_service)) -> dict:
    return ok(
        schemas.InvoiceRead.model_validate(svc.create_invoice(payload)),
        message="Invoice created",
    )


@router.get(
    "/invoices/{invoice_id}", response_model=Envelope[schemas.InvoiceRead], dependencies=[VIEW]
)
def get_invoice(invoice_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.InvoiceRead.model_validate(svc.get_invoice(invoice_id)))


@router.post(
    "/invoices/{invoice_id}/post",
    response_model=Envelope[schemas.InvoiceRead],
    dependencies=[APPROVE],
)
def post_invoice(invoice_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.InvoiceRead.model_validate(svc.post_invoice(invoice_id)), message="Posted")


@router.post(
    "/invoices/{invoice_id}/cancel",
    response_model=Envelope[schemas.InvoiceRead],
    dependencies=[APPROVE],
)
def cancel_invoice(invoice_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(
        schemas.InvoiceRead.model_validate(svc.cancel_invoice(invoice_id)), message="Cancelled"
    )

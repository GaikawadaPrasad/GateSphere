"""Maintenance & Billing API (FR-09). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `billing:{view,create,update,approve,export}`.
Contract: docs/backend/api/billing.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.export import EXPORT_ROW_CAP, csv_response
from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.billing import schemas
from app.modules.billing.deps import billing_service
from app.modules.billing.service import BillingService

router = APIRouter(prefix="/billing", tags=["Maintenance & Billing"])

VIEW = Depends(require_permission_async("billing:view"))
CREATE = Depends(require_permission_async("billing:create"))
UPDATE = Depends(require_permission_async("billing:update"))
APPROVE = Depends(require_permission_async("billing:approve"))
EXPORT = Depends(require_permission_async("billing:export"))

Svc = BillingService


@router.get("/health", summary="Maintenance & Billing module liveness")
async def module_health() -> dict:
    return ok({"module": "billing", "status": "ok"})


# --- charge heads --------------------------------------------------- #
@router.get(
    "/charge-heads", response_model=Envelope[list[schemas.ChargeHeadRead]], dependencies=[VIEW]
)
async def list_charge_heads(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(billing_service)
) -> dict:
    return ok(
        [
            schemas.ChargeHeadRead.model_validate(r)
            for r in await svc.list_charge_heads(community_id=community_id)
        ]
    )


@router.post(
    "/charge-heads",
    response_model=Envelope[schemas.ChargeHeadRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
async def create_charge_head(
    payload: schemas.ChargeHeadCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(billing_service),
) -> dict:
    return ok(
        schemas.ChargeHeadRead.model_validate(
            await svc.create_charge_head(payload, community_id=community_id)
        ),
        message="Created",
    )


@router.patch(
    "/charge-heads/{charge_head_id}",
    response_model=Envelope[schemas.ChargeHeadRead],
    dependencies=[APPROVE],
)
async def update_charge_head(
    charge_head_id: uuid.UUID,
    payload: schemas.ChargeHeadUpdate,
    svc: Svc = Depends(billing_service),
) -> dict:
    return ok(
        schemas.ChargeHeadRead.model_validate(
            await svc.update_charge_head(charge_head_id, payload)
        ),
        message="Updated",
    )


# --- billing rules ---------------------------------------------- #
@router.get("/rules", response_model=Envelope[schemas.RuleRead], dependencies=[VIEW])
async def get_rule(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(billing_service)
) -> dict:
    return ok(schemas.RuleRead.model_validate(await svc.get_rule(community_id=community_id)))


@router.patch("/rules", response_model=Envelope[schemas.RuleRead], dependencies=[APPROVE])
async def update_rule(
    payload: schemas.RuleUpdate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(billing_service),
) -> dict:
    return ok(
        schemas.RuleRead.model_validate(await svc.update_rule(payload, community_id=community_id)),
        message="Updated",
    )


# --- payments ------------------------------------------------- #
@router.get("/payments", response_model=Envelope[list[schemas.PaymentRead]], dependencies=[VIEW])
async def list_payments(
    community_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(billing_service),
) -> dict:
    rows, total = await svc.list_payments(
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
async def record_payment(
    payload: schemas.PaymentCreate, svc: Svc = Depends(billing_service)
) -> dict:
    return ok(
        schemas.PaymentRead.model_validate(await svc.record_payment(payload)),
        message="Payment recorded",
    )


@router.get(
    "/payments/{payment_id}", response_model=Envelope[schemas.PaymentRead], dependencies=[VIEW]
)
async def get_payment(payment_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.PaymentRead.model_validate(await svc.get_payment(payment_id)))


@router.get(
    "/payments/{payment_id}/receipt",
    response_model=Envelope[schemas.ReceiptRead],
    dependencies=[VIEW],
)
async def get_payment_receipt(payment_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.ReceiptRead.model_validate(await svc.get_receipt(payment_id)))


@router.post(
    "/payments/{payment_id}/refund",
    response_model=Envelope[schemas.PaymentRead],
    dependencies=[APPROVE],
)
async def refund_payment(
    payment_id: uuid.UUID,
    payload: schemas.PaymentRefund,
    svc: Svc = Depends(billing_service),
) -> dict:
    pay = await svc.refund_payment(payment_id, payload)
    return ok(schemas.PaymentRead.model_validate(pay), message="Refunded")


# --- ledger ------------------------------------------------- #
@router.get(
    "/units/{unit_id}/ledger",
    response_model=Envelope[list[schemas.LedgerRead]],
    dependencies=[VIEW],
)
async def unit_ledger(
    unit_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(billing_service),
) -> dict:
    rows, total = await svc.unit_ledger(unit_id, offset=params.offset, limit=params.page_size)
    return paginated(
        [schemas.LedgerRead.model_validate(r) for r in rows], total=total, params=params
    )


# --- invoices --------------------------------------------- #
@router.get("/invoices", response_model=Envelope[list[schemas.InvoiceRead]], dependencies=[VIEW])
async def list_invoices(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    invoice_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(billing_service),
) -> dict:
    rows, total = await svc.list_invoices(
        community_id=community_id,
        unit_id=unit_id,
        invoice_status=invoice_status,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.InvoiceRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get("/invoices.csv", dependencies=[EXPORT])
async def export_invoices(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    invoice_status: str | None = None,
    svc: Svc = Depends(billing_service),
):
    rows, _ = await svc.list_invoices(
        community_id=community_id,
        unit_id=unit_id,
        invoice_status=invoice_status,
        offset=0,
        limit=EXPORT_ROW_CAP,
    )
    return csv_response(
        "invoices.csv",
        [
            "invoice_number",
            "unit_id",
            "status",
            "total_amount",
            "amount_paid",
            "balance_due",
            "issue_date",
            "due_date",
            "created_at",
        ],
        (
            (
                i.invoice_number,
                i.unit_id,
                i.status,
                i.total_amount,
                i.amount_paid,
                i.balance_due,
                i.issue_date,
                i.due_date,
                i.created_at,
            )
            for i in rows
        ),
    )


@router.get("/payments.csv", dependencies=[EXPORT])
async def export_payments(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(billing_service)
):
    rows, _ = await svc.list_payments(community_id=community_id, offset=0, limit=EXPORT_ROW_CAP)
    return csv_response(
        "payments.csv",
        [
            "payment_reference",
            "receipt_number",
            "amount",
            "payment_method",
            "payment_status",
            "paid_at",
            "refunded_at",
        ],
        (
            (
                p.payment_reference,
                p.receipt_number,
                p.amount,
                p.payment_method,
                p.payment_status,
                p.paid_at,
                p.refunded_at,
            )
            for p in rows
        ),
    )


@router.post(
    "/invoices",
    response_model=Envelope[schemas.InvoiceRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_invoice(
    payload: schemas.InvoiceCreate, svc: Svc = Depends(billing_service)
) -> dict:
    return ok(
        schemas.InvoiceRead.model_validate(await svc.create_invoice(payload)),
        message="Invoice created",
    )


@router.get(
    "/invoices/{invoice_id}", response_model=Envelope[schemas.InvoiceRead], dependencies=[VIEW]
)
async def get_invoice(invoice_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(schemas.InvoiceRead.model_validate(await svc.get_invoice(invoice_id)))


@router.post(
    "/invoices/{invoice_id}/post",
    response_model=Envelope[schemas.InvoiceRead],
    dependencies=[APPROVE],
)
async def post_invoice(invoice_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(
        schemas.InvoiceRead.model_validate(await svc.post_invoice(invoice_id)), message="Posted"
    )


@router.post(
    "/invoices/{invoice_id}/cancel",
    response_model=Envelope[schemas.InvoiceRead],
    dependencies=[APPROVE],
)
async def cancel_invoice(invoice_id: uuid.UUID, svc: Svc = Depends(billing_service)) -> dict:
    return ok(
        schemas.InvoiceRead.model_validate(await svc.cancel_invoice(invoice_id)),
        message="Cancelled",
    )

"""Maintenance & Billing API (FR-09). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `billing:{view,create,update,approve,export}`.
Contract: docs/backend/api/billing.md.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status

from app.core.errors import NotFoundError
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
@router.get("/invoices/export", dependencies=[EXPORT])
async def export_invoices(
    community_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    invoice_status: str | None = None,
    status: str | None = None,
    svc: Svc = Depends(billing_service),
):
    rows, _ = await svc.list_invoices(
        community_id=community_id,
        unit_id=unit_id,
        invoice_status=invoice_status or status,
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
@router.get("/payments/export", dependencies=[EXPORT])
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


# --- special assessments (Governance FR-09 / Association Committee) --- #
_SPECIAL_ASSESSMENTS_STORE: dict[str, dict] = {}


def _get_default_assessments(community_id: str | None = None) -> list[dict]:
    cid = community_id or "default"
    now_iso = datetime.now(UTC).isoformat()
    return [
        {
            "id": "sa-solar-001",
            "community_id": cid,
            "title": "Clubhouse Solar Panel Infrastructure",
            "purpose": "CapEx Infrastructure",
            "description": "Installation of a 50kW rooftop grid-tied solar photovoltaic array on the central clubhouse to reduce common area electricity utility overhead by estimated 65%.",
            "target_amount": "48000.00",
            "amount_collected": "0.00",
            "per_unit_amount": "400.00",
            "effective_date": "2026-10-01",
            "due_date": "2026-11-15",
            "affected_units_count": 120,
            "status": "under_review",
            "created_at": now_iso,
            "updated_at": now_iso,
        },
        {
            "id": "sa-elevator-002",
            "community_id": cid,
            "title": "Elevator Traction Modernization & ARD Batteries",
            "purpose": "Equipment Overhaul",
            "description": "Comprehensive overhaul of Tower A and Tower B passenger elevator traction ropes, controller boards, and automatic rescue device (ARD) backup battery systems.",
            "target_amount": "36000.00",
            "amount_collected": "14400.00",
            "per_unit_amount": "300.00",
            "effective_date": "2026-08-15",
            "due_date": "2026-09-30",
            "affected_units_count": 120,
            "status": "approved",
            "approved_at": now_iso,
            "approval_notes": "Approved unanimously per AGM Resolution #4. Execution scheduled for Q4.",
            "created_at": now_iso,
            "updated_at": now_iso,
        },
        {
            "id": "sa-security-003",
            "community_id": cid,
            "title": "Perimeter Smart Security & ANPR Upgrade",
            "purpose": "Security & Surveillance Upgrade",
            "description": "Deployment of 4K night-vision AI security cameras at all boundary walls and automated number plate recognition (ANPR) cameras at Main & Service Gates.",
            "target_amount": "18000.00",
            "amount_collected": "18000.00",
            "per_unit_amount": "150.00",
            "effective_date": "2026-07-01",
            "due_date": "2026-08-15",
            "affected_units_count": 120,
            "status": "active",
            "approved_at": now_iso,
            "approval_notes": "Security audit priority recommendation completed.",
            "created_at": now_iso,
            "updated_at": now_iso,
        },
    ]


@router.get("/assessments", dependencies=[VIEW])
async def list_assessments(
    community_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    cid = str(community_id) if community_id else None
    key = cid or "all"
    if key not in _SPECIAL_ASSESSMENTS_STORE:
        for sa in _get_default_assessments(cid):
            _SPECIAL_ASSESSMENTS_STORE[sa["id"]] = sa

    items = []
    for sa in _SPECIAL_ASSESSMENTS_STORE.values():
        if cid and sa.get("community_id") != cid and sa.get("community_id") != "default":
            continue
        if status and status != "all" and sa.get("status") != status:
            continue
        items.append(sa)

    return ok(items)


@router.get("/assessments/{assessment_id}", dependencies=[VIEW])
async def get_assessment(assessment_id: str) -> dict:
    sa = _SPECIAL_ASSESSMENTS_STORE.get(assessment_id)
    if not sa:
        for default_sa in _get_default_assessments():
            if default_sa["id"] == assessment_id:
                _SPECIAL_ASSESSMENTS_STORE[assessment_id] = default_sa
                sa = default_sa
                break
    if not sa:
        raise NotFoundError("Special assessment not found")
    return ok(sa)


@router.post("/assessments", status_code=status.HTTP_201_CREATED, dependencies=[CREATE])
async def create_assessment(
    payload: dict,
    community_id: str | None = None,
) -> dict:
    cid = str(community_id or payload.get("community_id") or "default")
    sa_id = f"sa-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(UTC).isoformat()

    target_amt = str(payload.get("target_amount") or "0.00")
    try:
        units_count = int(payload.get("affected_units_count") or 120)
    except (ValueError, TypeError):
        units_count = 120

    try:
        per_unit = str(payload.get("per_unit_amount") or f"{float(target_amt) / max(units_count, 1):.2f}")
    except (ValueError, TypeError):
        per_unit = "0.00"

    new_sa = {
        "id": sa_id,
        "community_id": cid,
        "title": payload.get("title", "Special Assessment Proposal"),
        "purpose": payload.get("purpose", "CapEx Infrastructure"),
        "description": payload.get("description", ""),
        "target_amount": target_amt,
        "amount_collected": "0.00",
        "per_unit_amount": per_unit,
        "effective_date": payload.get("effective_date", datetime.now(UTC).strftime("%Y-%m-%d")),
        "due_date": payload.get("due_date", ""),
        "affected_units_count": units_count,
        "status": "under_review",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    _SPECIAL_ASSESSMENTS_STORE[sa_id] = new_sa
    return ok(new_sa, message="Special assessment proposal submitted for review")


@router.post("/assessments/{assessment_id}/approve", dependencies=[APPROVE])
async def approve_assessment(
    assessment_id: str,
    payload: dict | None = None,
) -> dict:
    sa = _SPECIAL_ASSESSMENTS_STORE.get(assessment_id)
    if not sa:
        for default_sa in _get_default_assessments():
            if default_sa["id"] == assessment_id:
                _SPECIAL_ASSESSMENTS_STORE[assessment_id] = default_sa
                sa = default_sa
                break
    if not sa:
        raise NotFoundError("Special assessment not found")

    sa["status"] = "approved"
    sa["approved_at"] = datetime.now(UTC).isoformat()
    sa["approval_notes"] = (payload.get("notes") if payload else None) or "Approved by Association Committee"
    sa["updated_at"] = datetime.now(UTC).isoformat()
    return ok(sa, message="Special assessment approved")


@router.post("/assessments/{assessment_id}/reject", dependencies=[APPROVE])
async def reject_assessment(
    assessment_id: str,
    payload: dict | None = None,
) -> dict:
    sa = _SPECIAL_ASSESSMENTS_STORE.get(assessment_id)
    if not sa:
        for default_sa in _get_default_assessments():
            if default_sa["id"] == assessment_id:
                _SPECIAL_ASSESSMENTS_STORE[assessment_id] = default_sa
                sa = default_sa
                break
    if not sa:
        raise NotFoundError("Special assessment not found")

    sa["status"] = "rejected"
    sa["rejection_reason"] = (payload.get("reason") if payload else None) or "Rejected by Association Committee"
    sa["updated_at"] = datetime.now(UTC).isoformat()
    return ok(sa, message="Special assessment rejected")

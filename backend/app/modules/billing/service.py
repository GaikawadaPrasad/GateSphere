"""Business logic for Maintenance & Billing (FR-09).

- Invoice totals: `subtotal = sum(qty * rate)`, `tax = sum(taxable lines) * rule.tax_percent`,
  `total = subtotal - discount + tax + late_fee`, `balance_due = total - amount_paid`.
- A **draft** invoice can be edited/cancelled; **posting** freezes it and writes a ledger debit.
- Payments are **simulated** (no gateway). Allocations must sum to the payment amount and
  never exceed an invoice's balance. Each allocation writes a ledger credit and advances the
  invoice status (`posted -> partially_paid -> paid`).
- `ledger_entries` is append-only; `balance_after` is recomputed transactionally per unit.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.billing import schemas
from app.modules.billing.models import (
    BillingRule,
    ChargeHead,
    InvoiceItem,
    LedgerEntry,
    MaintenanceInvoice,
    Payment,
    PaymentAllocation,
)
from app.modules.billing.repository import (
    ChargeHeadRepository,
    InvoiceRepository,
    LedgerRepository,
    PaymentRepository,
    RuleRepository,
)
from app.modules.billing.schemas import ALLOWED
from app.modules.communities.models import Unit
from app.modules.notifications import events as notif_events
from app.modules.residents.access import UnitScopedAccess
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import User

_Q = Decimal("0.01")
_DEFAULT_RULE = {
    "due_day": 10,
    "grace_days": 5,
    "late_fee_mode": "flat",
    "late_fee_value": Decimal("0"),
    "tax_percent": Decimal("0"),
    "allow_advance_payment": True,
}


def _money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(_Q)


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class BillingService(UnitScopedAccess):
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.charge_heads = ChargeHeadRepository(db, scope)
        self.rules = RuleRepository(db, scope)
        self.invoices = InvoiceRepository(db, scope)
        self.payments = PaymentRepository(db, scope)
        self.ledger = LedgerRepository(db, scope)

    async def _audit(self, action, community_id, entity_type, entity_id, **kw):
        await record_audit_async(
            self.db,
            module="billing",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            request=self.request,
            **kw,
        )

    def _one_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    async def _unit_in_scope(self, unit_id: uuid.UUID) -> Unit:
        stmt = select(Unit).where(Unit.id == unit_id)
        if not self.scope.is_global:
            stmt = stmt.where(Unit.community_id.in_(self.scope.community_ids))
        unit = await self.db.scalar(stmt)
        if unit is None:
            raise NotFoundError("Unit not found")
        return unit

    async def _rule(self, community_id: uuid.UUID) -> BillingRule:
        obj = await self.rules.for_community(community_id)
        if obj is None:
            obj = BillingRule(community_id=community_id, **_DEFAULT_RULE)
            await self.rules.add(obj)
        return obj

    async def _primary_billed_user(self, unit_id: uuid.UUID) -> uuid.UUID | None:
        occ = await self.db.scalar(
            select(UnitOccupancy).where(
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.is_primary.is_(True),
                UnitOccupancy.is_active.is_(True),
            )
        )
        if occ is None:
            return None
        profile = await self.db.get(ResidentProfile, occ.resident_profile_id)
        return profile.user_id if profile else None

    async def _ledger(
        self,
        community_id: uuid.UUID,
        unit_id: uuid.UUID | None,
        user_id: uuid.UUID | None,
        entry_type: str,
        amount: Decimal,
        *,
        source_type: str,
        source_id: uuid.UUID,
        narration: str,
    ) -> None:
        prev = await self.ledger.latest_balance(unit_id)
        base = Decimal(prev.balance_after) if prev is not None else Decimal("0")
        delta = amount if entry_type == "debit" else -amount
        self.db.add(
            LedgerEntry(
                community_id=community_id,
                unit_id=unit_id,
                user_id=user_id,
                entry_type=entry_type,
                source_type=source_type,
                source_id=source_id,
                amount=_money(amount),
                balance_after=_money(base + delta),
                narration=narration,
            )
        )
        await self.db.flush()

    # -- charge heads ------------------------------------------ #
    async def list_charge_heads(self, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        stmt = select(ChargeHead).where(ChargeHead.community_id == cid).order_by(ChargeHead.code)
        return list((await self.db.scalars(stmt)).all())

    async def create_charge_head(
        self, payload: schemas.ChargeHeadCreate, *, community_id: uuid.UUID | None
    ):
        cid = self._one_community(community_id)
        _enum("calculation_type", payload.calculation_type)
        if await self.charge_heads.by_code(cid, payload.code):
            raise ConflictError("That code exists", code="CHARGE_HEAD_EXISTS")
        obj = ChargeHead(community_id=cid, **payload.model_dump())
        await self.charge_heads.add(obj)
        await self._audit("charge_head.create", cid, "charge_head", obj.id)
        return obj

    async def update_charge_head(
        self, charge_head_id: uuid.UUID, payload: schemas.ChargeHeadUpdate
    ):
        obj = await self.charge_heads.get(charge_head_id)
        if obj is None:
            raise NotFoundError("Charge head not found")
        patch = payload.model_dump(exclude_unset=True)
        _enum("calculation_type", patch.get("calculation_type"))
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("charge_head.update", obj.community_id, "charge_head", obj.id, new=patch)
        return obj

    # -- rules ----------------------------------------------- #
    async def get_rule(self, *, community_id: uuid.UUID | None):
        return await self._rule(self._one_community(community_id))

    async def update_rule(self, payload: schemas.RuleUpdate, *, community_id: uuid.UUID | None):
        obj = await self._rule(self._one_community(community_id))
        patch = payload.model_dump(exclude_unset=True)
        _enum("late_fee_mode", patch.get("late_fee_mode"))
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("rule.update", obj.community_id, "billing_rule", obj.id, new=patch)
        return obj

    # -- invoices ------------------------------------------ #
    async def create_invoice(self, payload: schemas.InvoiceCreate) -> MaintenanceInvoice:
        if await self.is_unit_restricted():
            raise ForbiddenError("Only community staff can raise invoices", code="STAFF_ONLY")
        unit = await self._unit_in_scope(payload.unit_id)
        rule = await self._rule(unit.community_id)
        seq = await self.invoices.next_sequence(unit.community_id)
        inv = MaintenanceInvoice(
            community_id=unit.community_id,
            unit_id=unit.id,
            billed_to_user_id=await self._primary_billed_user(unit.id),
            invoice_number=f"INV-{datetime.now(UTC).year}-{seq:05d}",
            billing_period_start=payload.billing_period_start,
            billing_period_end=payload.billing_period_end,
            issue_date=payload.issue_date or date.today(),
            due_date=payload.due_date,
            discount=_money(payload.discount),
            status="draft",
        )
        subtotal = Decimal("0")
        taxable_base = Decimal("0")
        for line in payload.items:
            amount = _money(line.quantity * line.unit_rate)
            subtotal += amount
            if line.taxable:
                taxable_base += amount
            inv.items.append(
                InvoiceItem(
                    charge_head_id=line.charge_head_id,
                    description=line.description,
                    quantity=line.quantity,
                    unit_rate=_money(line.unit_rate),
                    amount=amount,
                    taxable=line.taxable,
                )
            )
        tax = _money(taxable_base * rule.tax_percent / Decimal("100"))
        inv.subtotal = _money(subtotal)
        inv.tax = tax
        inv.total_amount = _money(subtotal - inv.discount + tax)
        inv.amount_paid = Decimal("0.00")
        inv.balance_due = inv.total_amount
        await self.invoices.add(inv)
        await self._audit(
            "invoice.create",
            unit.community_id,
            "invoice",
            inv.id,
            new={"invoice_number": inv.invoice_number, "total": str(inv.total_amount)},
        )
        return await self.get_invoice(inv.id)

    async def get_invoice(self, invoice_id: uuid.UUID) -> MaintenanceInvoice:
        obj = await self.invoices.get(invoice_id)
        if obj is None:
            raise NotFoundError("Invoice not found")
        await self._assert_unit_visible(obj.unit_id)
        return obj

    async def list_invoices(
        self,
        *,
        community_id: uuid.UUID | None,
        unit_id: uuid.UUID | None,
        invoice_status: str | None,
        offset: int,
        limit: int,
    ):
        _enum("invoice_status", invoice_status)
        stmt = select(MaintenanceInvoice).options(selectinload(MaintenanceInvoice.items))
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(MaintenanceInvoice.community_id == community_id)
        if unit_id:
            stmt = stmt.where(MaintenanceInvoice.unit_id == unit_id)
        if invoice_status:
            stmt = stmt.where(MaintenanceInvoice.status == invoice_status)
        stmt = stmt.order_by(MaintenanceInvoice.created_at.desc())
        stmt = await self._scope_unit_column(stmt, MaintenanceInvoice.unit_id)
        return await self.invoices.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.invoices.count(extra=stmt)

    async def post_invoice(self, invoice_id: uuid.UUID) -> MaintenanceInvoice:
        inv = await self.get_invoice(invoice_id)
        if inv.status != "draft":
            raise BusinessRuleError(
                f"Invoice is '{inv.status}', not draft", code="INVALID_TRANSITION"
            )
        inv.status = "posted"
        await self._ledger(
            inv.community_id,
            inv.unit_id,
            inv.billed_to_user_id,
            "debit",
            inv.total_amount,
            source_type="invoice",
            source_id=inv.id,
            narration=f"Invoice {inv.invoice_number} posted",
        )
        await self.db.flush()
        await self._audit("invoice.post", inv.community_id, "invoice", inv.id)
        await notif_events.emit(
            self.db,
            self.scope,
            self.actor,
            self.request,
            recipient_user_id=inv.billed_to_user_id,
            community_id=inv.community_id,
            notification_type="billing.invoice_posted",
            title=f"Invoice {inv.invoice_number}",
            message=f"A maintenance invoice of {inv.total_amount} is due"
            + (f" by {inv.due_date}." if inv.due_date else "."),
            reference_type="invoice",
            reference_id=inv.id,
        )
        return await self.get_invoice(inv.id)

    async def cancel_invoice(self, invoice_id: uuid.UUID) -> MaintenanceInvoice:
        inv = await self.get_invoice(invoice_id)
        if inv.amount_paid > 0:
            raise BusinessRuleError("Invoice has payments", code="INVOICE_HAS_PAYMENTS")
        if inv.status not in ("draft", "posted", "overdue"):
            raise BusinessRuleError(
                f"Cannot cancel a '{inv.status}' invoice", code="INVALID_TRANSITION"
            )
        if inv.status in ("posted", "overdue"):
            await self._ledger(
                inv.community_id,
                inv.unit_id,
                inv.billed_to_user_id,
                "credit",
                inv.total_amount,
                source_type="invoice_cancel",
                source_id=inv.id,
                narration=f"Invoice {inv.invoice_number} cancelled",
            )
        inv.status = "cancelled"
        inv.balance_due = Decimal("0.00")
        await self.db.flush()
        await self._audit("invoice.cancel", inv.community_id, "invoice", inv.id)
        return await self.get_invoice(inv.id)

    # -- payments --------------------------------------- #
    async def record_payment(self, payload: schemas.PaymentCreate) -> Payment:
        cid = self._one_community(payload.community_id)
        _enum("payment_method", payload.payment_method)
        alloc_total = sum((a.amount for a in payload.allocations), Decimal("0"))
        if _money(alloc_total) != _money(payload.amount):
            raise BusinessRuleError(
                "Allocations must sum to the payment amount", code="ALLOCATION_MISMATCH"
            )
        now = datetime.now(UTC)
        rseq = await self.payments.next_receipt_sequence(cid)
        payment = Payment(
            community_id=cid,
            payer_user_id=payload.payer_user_id or self.actor.id,
            payment_reference=f"PAY-{secrets.token_hex(8).upper()}",
            receipt_number=f"RCP-{now.year}-{rseq:06d}",
            receipt_issued_at=now,
            amount=_money(payload.amount),
            payment_method=payload.payment_method,
            payment_status="success",
            paid_at=now,
            gateway_name="simulated",
            remarks=payload.remarks,
        )
        await self.payments.add(payment)

        for line in payload.allocations:
            inv = await self.invoices.get(line.invoice_id)
            if inv is None or inv.community_id != cid:
                raise NotFoundError("Invoice not found")
            await self._assert_unit_visible(inv.unit_id)
            if inv.status not in ("posted", "partially_paid", "overdue"):
                raise BusinessRuleError(
                    f"Invoice {inv.invoice_number} is '{inv.status}'", code="INVOICE_NOT_PAYABLE"
                )
            amt = _money(line.amount)
            if amt > inv.balance_due:
                raise BusinessRuleError(
                    f"Allocation exceeds balance on {inv.invoice_number}",
                    code="OVER_ALLOCATION",
                )
            self.db.add(
                PaymentAllocation(payment_id=payment.id, invoice_id=inv.id, allocated_amount=amt)
            )
            inv.amount_paid = _money(inv.amount_paid + amt)
            inv.balance_due = _money(inv.total_amount - inv.amount_paid)
            inv.status = "paid" if inv.balance_due <= 0 else "partially_paid"
            await self._ledger(
                cid,
                inv.unit_id,
                payment.payer_user_id,
                "credit",
                amt,
                source_type="payment",
                source_id=payment.id,
                narration=f"Payment {payment.payment_reference} -> {inv.invoice_number}",
            )
        await self.db.flush()
        await self._audit(
            "payment.record",
            cid,
            "payment",
            payment.id,
            new={"amount": str(payment.amount), "ref": payment.payment_reference},
        )
        return await self.get_payment(payment.id)

    async def get_payment(self, payment_id: uuid.UUID) -> Payment:
        obj = await self.payments.get(payment_id)
        if obj is None:
            raise NotFoundError("Payment not found")
        if (await self.is_unit_restricted()) and obj.payer_user_id != self.actor.id:
            raise NotFoundError("Payment not found")
        return obj

    async def get_receipt(self, payment_id: uuid.UUID) -> dict:
        from app.modules.communities.models import Community

        pay = await self.get_payment(payment_id)
        community = await self.db.get(Community, pay.community_id)
        payer = await self.db.get(User, pay.payer_user_id) if pay.payer_user_id else None
        lines = []
        for alloc in pay.allocations:
            inv = await self.db.get(MaintenanceInvoice, alloc.invoice_id)
            lines.append(
                {
                    "invoice_id": alloc.invoice_id,
                    "invoice_number": inv.invoice_number if inv else None,
                    "amount": alloc.allocated_amount,
                }
            )
        return {
            "receipt_number": pay.receipt_number,
            "payment_reference": pay.payment_reference,
            "community_name": community.name if community else None,
            "payer_name": payer.full_name if payer else None,
            "amount": pay.amount,
            "payment_method": pay.payment_method,
            "payment_status": pay.payment_status,
            "paid_at": pay.paid_at,
            "issued_at": pay.receipt_issued_at,
            "allocations": lines,
        }

    async def list_payments(self, *, community_id: uuid.UUID | None, offset: int, limit: int):
        stmt = select(Payment).options(selectinload(Payment.allocations))
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(Payment.community_id == community_id)
        stmt = stmt.order_by(Payment.paid_at.desc())
        stmt = await self._scope_owned(stmt, Payment.payer_user_id)
        return await self.payments.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.payments.count(extra=stmt)

    # -- ledger --------------------------------------- #
    async def unit_ledger(self, unit_id: uuid.UUID, *, offset: int, limit: int):
        await self._unit_in_scope(unit_id)
        await self._assert_unit_visible(unit_id)
        stmt = (
            select(LedgerEntry)
            .where(LedgerEntry.unit_id == unit_id)
            .order_by(LedgerEntry.entry_seq.desc())
        )
        return await self.ledger.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.ledger.count(extra=stmt)

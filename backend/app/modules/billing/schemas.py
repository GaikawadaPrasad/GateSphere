"""Pydantic models for Maintenance & Billing (FR-09). Write bodies are `extra="forbid"`."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.billing.models import (
    CALCULATION_TYPES,
    INVOICE_STATUS,
    LATE_FEE_MODES,
    PAYMENT_METHODS,
    PAYMENT_STATUS,
)

ALLOWED = {
    "calculation_type": set(CALCULATION_TYPES),
    "invoice_status": set(INVOICE_STATUS),
    "payment_method": set(PAYMENT_METHODS),
    "payment_status": set(PAYMENT_STATUS),
    "late_fee_mode": set(LATE_FEE_MODES),
}
_Amount = Field(max_digits=12, decimal_places=2, ge=0)


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# -- charge heads ------------------------------------------------- #
class ChargeHeadCreate(_Write):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=120)
    calculation_type: str = "flat"
    default_amount: Decimal = Field(default=Decimal("0"), max_digits=12, decimal_places=2, ge=0)
    taxable: bool = False


class ChargeHeadUpdate(_Write):
    name: str | None = Field(default=None, max_length=120)
    calculation_type: str | None = None
    default_amount: Decimal | None = Field(default=None, max_digits=12, decimal_places=2, ge=0)
    taxable: bool | None = None
    is_active: bool | None = None


class ChargeHeadRead(_Read):
    community_id: uuid.UUID
    code: str
    name: str
    calculation_type: str
    default_amount: Decimal
    taxable: bool
    is_active: bool


# -- billing rules --------------------------------------------- #
class RuleUpdate(_Write):
    due_day: int | None = Field(default=None, ge=1, le=28)
    grace_days: int | None = Field(default=None, ge=0, le=60)
    late_fee_mode: str | None = None
    late_fee_value: Decimal | None = Field(default=None, max_digits=12, decimal_places=2, ge=0)
    tax_percent: Decimal | None = Field(default=None, max_digits=5, decimal_places=2, ge=0, le=100)
    allow_advance_payment: bool | None = None


class RuleRead(_Read):
    community_id: uuid.UUID
    due_day: int
    grace_days: int
    late_fee_mode: str
    late_fee_value: Decimal
    tax_percent: Decimal
    allow_advance_payment: bool


# -- invoices ------------------------------------------------ #
class InvoiceLineCreate(_Write):
    description: str = Field(min_length=1, max_length=255)
    charge_head_id: uuid.UUID | None = None
    quantity: Decimal = Field(default=Decimal("1"), max_digits=10, decimal_places=2, gt=0)
    unit_rate: Decimal = Field(default=Decimal("0"), max_digits=12, decimal_places=2, ge=0)
    taxable: bool = False


class InvoiceCreate(_Write):
    unit_id: uuid.UUID
    billing_period_start: date | None = None
    billing_period_end: date | None = None
    issue_date: date | None = None
    due_date: date | None = None
    discount: Decimal = Field(default=Decimal("0"), max_digits=12, decimal_places=2, ge=0)
    items: list[InvoiceLineCreate] = Field(min_length=1)


class InvoiceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    charge_head_id: uuid.UUID | None
    description: str
    quantity: Decimal
    unit_rate: Decimal
    amount: Decimal
    taxable: bool


class InvoiceRead(_Read):
    community_id: uuid.UUID
    unit_id: uuid.UUID
    billed_to_user_id: uuid.UUID | None
    invoice_number: str
    billing_period_start: date | None
    billing_period_end: date | None
    issue_date: date | None
    due_date: date | None
    subtotal: Decimal
    discount: Decimal
    late_fee: Decimal
    tax: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    status: str
    items: list[InvoiceItemRead] = []


# -- payments ---------------------------------------------- #
class PaymentAllocationIn(_Write):
    invoice_id: uuid.UUID
    amount: Decimal = Field(max_digits=12, decimal_places=2, gt=0)


class PaymentCreate(_Write):
    amount: Decimal = Field(max_digits=12, decimal_places=2, gt=0)
    payment_method: str = "upi"
    payer_user_id: uuid.UUID | None = None
    allocations: list[PaymentAllocationIn] = Field(min_length=1)
    remarks: str | None = Field(default=None, max_length=2000)
    community_id: uuid.UUID | None = None


class PaymentAllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    allocated_amount: Decimal


class PaymentRead(_Read):
    community_id: uuid.UUID
    payer_user_id: uuid.UUID | None
    payment_reference: str
    amount: Decimal
    payment_method: str
    payment_status: str
    paid_at: datetime
    remarks: str | None
    allocations: list[PaymentAllocationRead] = []


class LedgerRead(_Read):
    community_id: uuid.UUID
    unit_id: uuid.UUID | None
    user_id: uuid.UUID | None
    entry_type: str
    source_type: str
    source_id: uuid.UUID | None
    amount: Decimal
    balance_after: Decimal
    entry_date: datetime
    narration: str | None

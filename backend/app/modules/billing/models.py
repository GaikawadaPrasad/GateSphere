"""Maintenance & Billing (FR-09): charge heads, per-community billing rules, maintenance
invoices + line items, simulated payments + allocations, and an append-only ledger.

All tables are tenant-scoped (`community_id`). Money is `Numeric(12, 2)`. A **posted**
invoice is immutable except through payment allocation.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, pk

CALCULATION_TYPES = ("flat", "per_sqft", "per_unit", "percentage")
INVOICE_STATUS = (
    "draft",
    "posted",
    "partially_paid",
    "paid",
    "overdue",
    "cancelled",
)
PAYMENT_METHODS = ("upi", "card", "netbanking", "cash", "cheque", "wallet", "adjustment")
PAYMENT_STATUS = ("pending", "success", "failed", "refunded")
LEDGER_ENTRY_TYPES = ("debit", "credit")
LATE_FEE_MODES = ("none", "flat", "percentage")

_Money = Numeric(12, 2)


class ChargeHead(Base, TimestampMixin, TenantMixin):
    __tablename__ = "charge_heads"
    __table_args__ = (
        UniqueConstraint("community_id", "code"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(120))
    calculation_type: Mapped[str] = mapped_column(String(15), default="flat")
    default_amount: Mapped[Decimal] = mapped_column(_Money, default=0)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BillingRule(Base, TimestampMixin, TenantMixin):
    __tablename__ = "billing_rules"
    __table_args__ = (UniqueConstraint("community_id"),)

    id: Mapped[uuid.UUID] = pk()
    due_day: Mapped[int] = mapped_column(Integer, default=10)
    grace_days: Mapped[int] = mapped_column(Integer, default=5)
    late_fee_mode: Mapped[str] = mapped_column(String(12), default="flat")
    late_fee_value: Mapped[Decimal] = mapped_column(_Money, default=0)
    tax_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    allow_advance_payment: Mapped[bool] = mapped_column(Boolean, default=True)


class MaintenanceInvoice(Base, TimestampMixin, TenantMixin):
    __tablename__ = "maintenance_invoices"
    __table_args__ = (
        ForeignKeyConstraint(
            ["unit_id", "community_id"], ["units.id", "units.community_id"], ondelete="CASCADE"
        ),
        UniqueConstraint("community_id", "invoice_number"),
        UniqueConstraint("id", "community_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    unit_id: Mapped[uuid.UUID] = mapped_column(index=True)
    billed_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    invoice_number: Mapped[str] = mapped_column(String(40))
    billing_period_start: Mapped[date | None] = mapped_column(Date)
    billing_period_end: Mapped[date | None] = mapped_column(Date)
    issue_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(_Money, default=0)
    discount: Mapped[Decimal] = mapped_column(_Money, default=0)
    late_fee: Mapped[Decimal] = mapped_column(_Money, default=0)
    tax: Mapped[Decimal] = mapped_column(_Money, default=0)
    total_amount: Mapped[Decimal] = mapped_column(_Money, default=0)
    amount_paid: Mapped[Decimal] = mapped_column(_Money, default=0)
    balance_due: Mapped[Decimal] = mapped_column(_Money, default=0)
    status: Mapped[str] = mapped_column(String(15), default="draft", index=True)

    items: Mapped[list[InvoiceItem]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceItem(Base, TimestampMixin):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = pk()
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("maintenance_invoices.id", ondelete="CASCADE"), index=True
    )
    charge_head_id: Mapped[uuid.UUID | None] = mapped_column()
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=1)
    unit_rate: Mapped[Decimal] = mapped_column(_Money, default=0)
    amount: Mapped[Decimal] = mapped_column(_Money, default=0)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False)
    item_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)

    invoice: Mapped[MaintenanceInvoice] = relationship(back_populates="items")


class Payment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("payment_reference"),
        UniqueConstraint("community_id", "receipt_number", name="uq_payment_receipt_number"),
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
    )

    id: Mapped[uuid.UUID] = pk()
    payer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    payment_reference: Mapped[str] = mapped_column(String(60))
    receipt_number: Mapped[str | None] = mapped_column(String(40))
    receipt_issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    amount: Mapped[Decimal] = mapped_column(_Money)
    payment_method: Mapped[str] = mapped_column(String(15), default="upi")
    payment_status: Mapped[str] = mapped_column(String(12), default="success", index=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    gateway_name: Mapped[str | None] = mapped_column(String(40))
    gateway_transaction_id: Mapped[str | None] = mapped_column(String(80))
    remarks: Mapped[str | None] = mapped_column(Text)

    allocations: Mapped[list[PaymentAllocation]] = relationship(
        back_populates="payment", cascade="all, delete-orphan"
    )


class PaymentAllocation(Base, TimestampMixin):
    __tablename__ = "payment_allocations"
    __table_args__ = (
        CheckConstraint("allocated_amount > 0", name="ck_allocation_amount_positive"),
        UniqueConstraint("payment_id", "invoice_id"),
    )

    id: Mapped[uuid.UUID] = pk()
    payment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payments.id", ondelete="CASCADE"), index=True
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("maintenance_invoices.id", ondelete="CASCADE"), index=True
    )
    allocated_amount: Mapped[Decimal] = mapped_column(_Money)

    payment: Mapped[Payment] = relationship(back_populates="allocations")


class LedgerEntry(Base, TimestampMixin, TenantMixin):
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = pk()
    entry_seq: Mapped[int] = mapped_column(BigInteger, Identity(), index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    entry_type: Mapped[str] = mapped_column(String(10))
    source_type: Mapped[str] = mapped_column(String(30))
    source_id: Mapped[uuid.UUID | None] = mapped_column()
    amount: Mapped[Decimal] = mapped_column(_Money)
    balance_after: Mapped[Decimal] = mapped_column(_Money)
    entry_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), index=True
    )
    narration: Mapped[str | None] = mapped_column(Text)

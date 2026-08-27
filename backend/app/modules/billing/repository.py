"""Data-access for Maintenance & Billing (FR-09). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select

from app.db.repository import TenantRepository
from app.modules.billing.models import (
    BillingRule,
    ChargeHead,
    LedgerEntry,
    MaintenanceInvoice,
    Payment,
)


class ChargeHeadRepository(TenantRepository[ChargeHead]):
    model = ChargeHead

    def by_code(self, community_id: uuid.UUID, code: str) -> ChargeHead | None:
        return self.db.scalar(
            select(ChargeHead).where(
                ChargeHead.community_id == community_id, ChargeHead.code == code
            )
        )


class RuleRepository(TenantRepository[BillingRule]):
    model = BillingRule

    def for_community(self, community_id: uuid.UUID) -> BillingRule | None:
        return self.db.scalar(select(BillingRule).where(BillingRule.community_id == community_id))


class InvoiceRepository(TenantRepository[MaintenanceInvoice]):
    model = MaintenanceInvoice

    def next_sequence(self, community_id: uuid.UUID) -> int:
        n = self.db.scalar(
            select(func.count())
            .select_from(MaintenanceInvoice)
            .where(MaintenanceInvoice.community_id == community_id)
        )
        return int(n or 0) + 1


class PaymentRepository(TenantRepository[Payment]):
    model = Payment


class LedgerRepository(TenantRepository[LedgerEntry]):
    model = LedgerEntry

    def latest_balance(self, unit_id: uuid.UUID | None) -> object:
        stmt = (
            select(LedgerEntry)
            .where(LedgerEntry.unit_id == unit_id)
            .order_by(LedgerEntry.entry_seq.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

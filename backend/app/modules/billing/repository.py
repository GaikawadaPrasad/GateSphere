"""Data-access for Maintenance & Billing (FR-09). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.db.repository import AsyncTenantRepository
from app.modules.billing.models import (
    BillingRule,
    ChargeHead,
    LedgerEntry,
    MaintenanceInvoice,
    Payment,
)


class ChargeHeadRepository(AsyncTenantRepository[ChargeHead]):
    model = ChargeHead

    async def by_code(self, community_id: uuid.UUID, code: str) -> ChargeHead | None:
        return await self.db.scalar(
            select(ChargeHead).where(
                ChargeHead.community_id == community_id, ChargeHead.code == code
            )
        )


class RuleRepository(AsyncTenantRepository[BillingRule]):
    model = BillingRule

    async def for_community(self, community_id: uuid.UUID) -> BillingRule | None:
        return await self.db.scalar(
            select(BillingRule).where(BillingRule.community_id == community_id)
        )


class InvoiceRepository(AsyncTenantRepository[MaintenanceInvoice]):
    model = MaintenanceInvoice

    async def get(self, obj_id: uuid.UUID) -> MaintenanceInvoice | None:
        return await self.db.scalar(
            self._scoped(select(MaintenanceInvoice).where(MaintenanceInvoice.id == obj_id))
            .execution_options(populate_existing=True)
            .options(selectinload(MaintenanceInvoice.items))
        )

    async def next_sequence(self, community_id: uuid.UUID) -> int:
        n = await self.db.scalar(
            select(func.count())
            .select_from(MaintenanceInvoice)
            .where(MaintenanceInvoice.community_id == community_id)
        )
        return int(n or 0) + 1


class PaymentRepository(AsyncTenantRepository[Payment]):
    model = Payment

    async def get(self, obj_id: uuid.UUID) -> Payment | None:
        return await self.db.scalar(
            self._scoped(select(Payment).where(Payment.id == obj_id))
            .execution_options(populate_existing=True)
            .options(selectinload(Payment.allocations))
        )

    async def next_receipt_sequence(self, community_id: uuid.UUID) -> int:
        n = await self.db.scalar(
            select(func.count()).select_from(Payment).where(Payment.community_id == community_id)
        )
        return int(n or 0) + 1


class LedgerRepository(AsyncTenantRepository[LedgerEntry]):
    model = LedgerEntry

    async def latest_balance(self, unit_id: uuid.UUID | None) -> object:
        return await self.db.scalar(
            select(LedgerEntry)
            .where(LedgerEntry.unit_id == unit_id)
            .order_by(LedgerEntry.entry_seq.desc())
            .limit(1)
        )

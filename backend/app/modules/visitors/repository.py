"""Data-access for Visitor Management (FR-04)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.visitors.models import (
    Visitor,
    VisitorApproval,
    VisitorBlacklist,
    VisitorEntry,
    VisitorPass,
    VisitorPolicy,
    VisitorRequest,
)


class VisitorRepository(TenantRepository[Visitor]):
    model = Visitor

    def by_phone(self, community_id: uuid.UUID, phone: str) -> Visitor | None:
        return self.db.scalar(
            select(Visitor).where(Visitor.community_id == community_id, Visitor.phone == phone)
        )


class BlacklistRepository(TenantRepository[VisitorBlacklist]):
    model = VisitorBlacklist

    def match(
        self, community_id: uuid.UUID, phone_hash: str, id_hash: str | None
    ) -> VisitorBlacklist | None:
        clause = VisitorBlacklist.phone_hash == phone_hash
        if id_hash:
            clause = clause | (VisitorBlacklist.id_number_hash == id_hash)
        return self.db.scalar(
            select(VisitorBlacklist).where(
                VisitorBlacklist.community_id == community_id,
                VisitorBlacklist.is_active.is_(True),
                clause,
            )
        )


class RequestRepository(TenantRepository[VisitorRequest]):
    model = VisitorRequest


class EntryRepository(TenantRepository[VisitorEntry]):
    model = VisitorEntry

    def open_for_visitor(
        self, community_id: uuid.UUID, visitor_id: uuid.UUID
    ) -> VisitorEntry | None:
        return self.db.scalar(
            select(VisitorEntry).where(
                VisitorEntry.community_id == community_id,
                VisitorEntry.visitor_id == visitor_id,
                VisitorEntry.status == "inside",
            )
        )


class PolicyRepository(TenantRepository[VisitorPolicy]):
    model = VisitorPolicy

    def for_community(self, community_id: uuid.UUID) -> VisitorPolicy | None:
        return self.db.scalar(
            select(VisitorPolicy).where(VisitorPolicy.community_id == community_id)
        )


def approval_row(db, request_id: uuid.UUID, approver_id: uuid.UUID) -> VisitorApproval | None:
    return db.scalar(
        select(VisitorApproval).where(
            VisitorApproval.request_id == request_id,
            VisitorApproval.approver_user_id == approver_id,
        )
    )


def pass_by_hash(db, token_hash: str) -> VisitorPass | None:
    return db.scalar(select(VisitorPass).where(VisitorPass.token_hash == token_hash))

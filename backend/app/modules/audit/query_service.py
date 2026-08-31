"""Read-side service for the Audit Logging query API (FR-16).

`audit_logs` is immutable — this service only reads. Results are **scoped**: a global caller
(Super Admin / Auditor) sees every community and platform-level rows (`community_id IS NULL`);
a community-scoped caller sees only their own community's rows.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.models import AuditLog
from app.modules.users.models import User


class AuditQueryService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request

    def _scoped(self, stmt):
        if self.scope.is_global:
            return stmt
        return stmt.where(AuditLog.community_id.in_(self.scope.community_ids))

    def _filtered(
        self,
        *,
        community_id: uuid.UUID | None,
        module: str | None,
        action: str | None,
        entity_type: str | None,
        entity_id: str | None,
        user_id: uuid.UUID | None,
        since: datetime | None,
        until: datetime | None,
    ):
        stmt = self._scoped(select(AuditLog))
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(AuditLog.community_id == community_id)
        if module:
            stmt = stmt.where(AuditLog.module == module)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
        if user_id is not None:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if since is not None:
            stmt = stmt.where(AuditLog.created_at >= since)
        if until is not None:
            stmt = stmt.where(AuditLog.created_at <= until)
        return stmt

    async def list_logs(self, *, offset: int, limit: int, **filters):
        stmt = self._filtered(**filters).order_by(AuditLog.created_at.desc())
        total = int(await self.db.scalar(stmt.with_only_columns(func.count()).order_by(None)) or 0)
        rows = list((await self.db.scalars(stmt.offset(offset).limit(limit))).all())
        return rows, total

    async def get_log(self, log_id: uuid.UUID) -> AuditLog:
        row = await self.db.scalar(self._scoped(select(AuditLog).where(AuditLog.id == log_id)))
        if row is None:
            raise NotFoundError("Audit log not found")
        return row

    async def export_csv(self, *, max_rows: int = 10000, **filters) -> str:
        stmt = self._filtered(**filters).order_by(AuditLog.created_at.desc()).limit(max_rows)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "created_at",
                "community_id",
                "user_id",
                "role_slug",
                "module",
                "action",
                "entity_type",
                "entity_id",
                "ip_address",
            ]
        )
        for r in (await self.db.scalars(stmt)).all():
            w.writerow(
                [
                    r.created_at.isoformat(),
                    r.community_id or "",
                    r.user_id or "",
                    r.role_slug or "",
                    r.module,
                    r.action,
                    r.entity_type or "",
                    r.entity_id or "",
                    r.ip_address or "",
                ]
            )
        return buf.getvalue()

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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.models import AuditLog
from app.modules.communities.models import Community
from app.modules.users.models import User


class AuditQueryService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx

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

    async def _enrich_logs(self, rows: list[AuditLog]) -> None:
        if not rows:
            return
        user_ids = {r.user_id for r in rows if r.user_id is not None}
        comm_ids = {r.community_id for r in rows if r.community_id is not None}

        user_map: dict[uuid.UUID, tuple[str, str]] = {}
        if user_ids:
            user_stmt = select(User.id, User.full_name, User.email).where(User.id.in_(user_ids))
            user_res = (await self.db.execute(user_stmt)).all()
            for uid, full_name, email in user_res:
                user_map[uid] = (full_name, email)

        comm_map: dict[uuid.UUID, tuple[str, str]] = {}
        if comm_ids:
            comm_stmt = select(Community.id, Community.name, Community.code).where(
                Community.id.in_(comm_ids)
            )
            comm_res = (await self.db.execute(comm_stmt)).all()
            for cid, name, code in comm_res:
                comm_map[cid] = (name, code)

        for r in rows:
            u_info = user_map.get(r.user_id) if r.user_id else None
            c_info = comm_map.get(r.community_id) if r.community_id else None
            r.user_name = u_info[0] if u_info else None
            r.user_email = u_info[1] if u_info else None
            r.community_name = c_info[0] if c_info else None
            r.community_code = c_info[1] if c_info else None

    async def list_logs(self, *, offset: int, limit: int, **filters):
        stmt = self._filtered(**filters).order_by(AuditLog.created_at.desc())
        total = int(await self.db.scalar(stmt.with_only_columns(func.count()).order_by(None)) or 0)
        rows = list((await self.db.scalars(stmt.offset(offset).limit(limit))).all())
        await self._enrich_logs(rows)
        return rows, total

    async def get_log(self, log_id: uuid.UUID) -> AuditLog:
        row = await self.db.scalar(self._scoped(select(AuditLog).where(AuditLog.id == log_id)))
        if row is None:
            raise NotFoundError("Audit log not found")
        await self._enrich_logs([row])
        return row

    async def export_csv(self, *, max_rows: int = 10000, **filters) -> str:
        stmt = self._filtered(**filters).order_by(AuditLog.created_at.desc()).limit(max_rows)
        rows = list((await self.db.scalars(stmt)).all())
        await self._enrich_logs(rows)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "created_at",
                "community_id",
                "community_name",
                "user_id",
                "user_name",
                "user_email",
                "role_slug",
                "module",
                "action",
                "entity_type",
                "entity_id",
                "ip_address",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r.created_at.isoformat(),
                    r.community_id or "",
                    getattr(r, "community_name", None) or "",
                    r.user_id or "",
                    getattr(r, "user_name", None) or "",
                    getattr(r, "user_email", None) or "",
                    r.role_slug or "",
                    r.module,
                    r.action,
                    r.entity_type or "",
                    r.entity_id or "",
                    r.ip_address or "",
                ]
            )
        return buf.getvalue()

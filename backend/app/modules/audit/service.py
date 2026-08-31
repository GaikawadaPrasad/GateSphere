"""Audit write helper (FR-16, NFR-REL-01).

Services call `record_audit_async(...)` **inside the same transaction** as the operation
they are auditing. Never update or delete an audit row (the DB trigger blocks it anyway —
migration 0028).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.modules.audit.models import AuditLog
from app.modules.users.models import User


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_jsonable(v) for v in value]
    if isinstance(value, uuid.UUID | Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    return value


def _build_audit_row(
    *,
    module: str,
    action: str,
    actor: User | None,
    community_id: uuid.UUID | None,
    entity_type: str | None,
    entity_id: uuid.UUID | str | None,
    old: dict | None,
    new: dict | None,
    ctx: RequestContext | None,
    role_slug: str | None,
) -> AuditLog:
    session_id = ctx.session_id if ctx else None
    return AuditLog(
        community_id=community_id,
        user_id=actor.id if actor else None,
        session_id=uuid.UUID(session_id) if isinstance(session_id, str) else session_id,
        role_slug=role_slug or (ctx.role_slug if ctx else None),
        module=module,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        old_values=_jsonable(old) if old else None,
        new_values=_jsonable(new) if new else None,
        ip_address=ctx.ip if ctx else None,
        user_agent=(ctx.user_agent if ctx else None) or None,
    )


async def record_audit_async(
    db: AsyncSession,
    *,
    module: str,
    action: str,
    actor: User | None = None,
    community_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | str | None = None,
    old: dict | None = None,
    new: dict | None = None,
    ctx: RequestContext | None = None,
    role_slug: str | None = None,
) -> AuditLog:
    """Append one immutable `audit_logs` row in the caller's transaction.

    `ctx` carries ip / user-agent / session / point-in-time role (framework-agnostic).
    `role_slug` overrides `ctx.role_slug` — used by login/logout and system jobs where
    `request.state` is not populated.
    """
    row = _build_audit_row(
        module=module,
        action=action,
        actor=actor,
        community_id=community_id,
        entity_type=entity_type,
        entity_id=entity_id,
        old=old,
        new=new,
        ctx=ctx,
        role_slug=role_slug,
    )
    db.add(row)
    await db.flush()
    return row

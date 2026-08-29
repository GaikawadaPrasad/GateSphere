"""Audit write helper (FR-16, NFR-REL-01).

Services call `record_audit_async(...)` **inside the same transaction** as the operation
they are auditing. Never update or delete an audit row.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

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
    request: Request | None,
) -> AuditLog:
    session_id = getattr(request.state, "session_id", None) if request else None
    return AuditLog(
        community_id=community_id,
        user_id=actor.id if actor else None,
        session_id=uuid.UUID(session_id) if isinstance(session_id, str) else session_id,
        module=module,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        old_values=_jsonable(old) if old else None,
        new_values=_jsonable(new) if new else None,
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("user-agent") if request else None) or None,
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
    request: Request | None = None,
) -> AuditLog:
    """Async twin of `record_audit` (ADR-010)."""
    row = _build_audit_row(
        module=module,
        action=action,
        actor=actor,
        community_id=community_id,
        entity_type=entity_type,
        entity_id=entity_id,
        old=old,
        new=new,
        request=request,
    )
    db.add(row)
    await db.flush()
    return row


def _client_ip(request: Request | None) -> str | None:
    if not request or not request.client:
        return None
    import ipaddress

    host = request.client.host
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        return None

"""Audit write helper (FR-16, NFR-REL-01).

Services call `record_audit(...)` **inside the same transaction** as the operation they are
auditing. Never update or delete an audit row.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog
from app.modules.users.models import User


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [_jsonable(v) for v in value]
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def record_audit(
    db: Session,
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
    session_id = getattr(request.state, "session_id", None) if request else None
    row = AuditLog(
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
    db.add(row)
    db.flush()
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

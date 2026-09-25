"""Realtime change hints (AGENTS.md §5.7) — the publishing half.

A state change queues a tiny *hint* on the DB session (`queue_community_event` — called from
`record_audit_async`, so every audited change is covered; `queue_user_event` — called when a
notification row is created). `get_async_db` / `job_session` publish the queue to Redis
pub/sub **after** the transaction commits and discard it on rollback, so a client is never
told about a change that did not happen.

A hint carries no record data — only `module` / `entity` / `action` (+ actor id, used
server-side to skip the actor's own connection). Clients react by invalidating the matching
queries; the REST API stays the only read path (the socket is never a second public schema).

Failure-tolerant by design (§9.1): Redis down ⇒ hints are dropped, clients fall back to
polling. Publishing never raises into the request.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

import structlog
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client, rkey

log = structlog.get_logger(__name__)

_INFO_KEY = "gs_realtime_events"
# Modules whose audit rows are not data changes a dashboard shows (login/logout, uploads).
_SILENT_MODULES = frozenset({"auth", "uploads", "assistant"})
# A per-recipient notification is announced on that user's own channel (`queue_user_event`);
# echoing its audit row community-wide would make every connected client refetch.
_SILENT_ACTIONS = frozenset({"notification.dispatch"})

COMMUNITY_CHANNEL_PREFIX = rkey("rt", "community")
USER_CHANNEL_PREFIX = rkey("rt", "user")


def community_channel(community_id: uuid.UUID | str) -> str:
    return f"{COMMUNITY_CHANNEL_PREFIX}:{community_id}"


def user_channel(user_id: uuid.UUID | str) -> str:
    return f"{USER_CHANNEL_PREFIX}:{user_id}"


def _queue(db: AsyncSession, channel: str, payload: dict[str, Any]) -> None:
    db.info.setdefault(_INFO_KEY, []).append((channel, payload))


def queue_community_event(
    db: AsyncSession,
    *,
    community_id: uuid.UUID | None,
    module: str,
    entity_type: str | None,
    action: str,
    actor_id: uuid.UUID | None,
) -> None:
    if community_id is None or module in _SILENT_MODULES or action in _SILENT_ACTIONS:
        return
    _queue(
        db,
        community_channel(community_id),
        {
            "type": "invalidate",
            "scope": "community",
            "module": module,
            "entity": entity_type,
            "action": action,
            "community_id": str(community_id),
            "actor_id": str(actor_id) if actor_id else None,
        },
    )


def queue_user_event(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_type: str,
    actor_id: uuid.UUID | None = None,
) -> None:
    """A notification landed for `user_id`. `module` is the notification type's prefix
    (`visitors.approval_requested` → `visitors`) so the client also refreshes that module."""
    module = notification_type.split(".", 1)[0] if notification_type else "notifications"
    _queue(
        db,
        user_channel(user_id),
        {
            "type": "invalidate",
            "scope": "user",
            "module": module,
            "entity": "notification",
            "action": "notification.created",
            "actor_id": str(actor_id) if actor_id else None,
        },
    )


def discard_pending(db: AsyncSession) -> None:
    db.info.pop(_INFO_KEY, None)


async def publish_pending(db: AsyncSession) -> None:
    """Publish (deduplicated) queued hints. Call only after a successful commit."""
    events = db.info.pop(_INFO_KEY, None)
    if not events:
        return
    unique: dict[str, tuple[str, str]] = {}
    for channel, payload in events:
        body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        unique.setdefault(channel + body, (channel, body))
    try:
        # The shared sync client (1 s socket timeout) in a worker thread: not bound to any
        # event loop, and never blocks the loop serving the request.
        await asyncio.to_thread(_publish_all, list(unique.values()))
    except (RedisError, OSError) as exc:  # hints are best-effort; clients poll as fallback
        log.debug("realtime.publish_failed", error=type(exc).__name__, count=len(unique))


def _publish_all(items: list[tuple[str, str]]) -> None:
    pipe = redis_client.pipeline(transaction=False)
    for channel, body in items:
        pipe.publish(channel, body)
    pipe.execute()

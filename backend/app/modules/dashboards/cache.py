"""Lightweight Redis-backed cache for read-only dashboard aggregates (REC-003).

Dashboard data is derived (counts/sums over other modules' tables). A short TTL
(60s) avoids hammering the DB on every page load while keeping data fresh enough
for real-time operations. Invalidation is opt-in: any write that changes a
dashboard-visible counter can call ``invalidate_dashboard_cache(community_id)``.

Redis is **never** the source of truth (AGENTS.md §9.1); a cache miss simply
re-runs the query. All keys go through ``rkey()`` (app/core/redis.py).
"""

from __future__ import annotations

import json
import logging
import uuid
from decimal import Decimal
from typing import Any

from app.core.redis import rkey, redis_client

logger = logging.getLogger(__name__)

# Default TTL for dashboard cache entries (seconds)
DASHBOARD_CACHE_TTL = 60


class _DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal values from financial aggregates."""

    def default(self, o: Any) -> Any:
        if isinstance(o, Decimal):
            return str(o)
        return super().default(o)


def _cache_key(endpoint: str, community_id: uuid.UUID | None, user_id: uuid.UUID | None = None) -> str:
    """Build a namespaced cache key for a dashboard endpoint.

    For user-specific endpoints (e.g. ``/resident``), the key includes the
    user_id so different residents don't share cached results.
    """
    parts = ["dashboard", endpoint]
    if community_id:
        parts.append(str(community_id))
    if user_id:
        parts.append(str(user_id))
    return rkey(*parts)


def get_cached(
    endpoint: str,
    community_id: uuid.UUID | None,
    user_id: uuid.UUID | None = None,
) -> dict | None:
    """Return cached dashboard data, or ``None`` on miss/error."""
    try:
        raw = redis_client.get(_cache_key(endpoint, community_id, user_id))
        if raw is not None:
            return json.loads(raw)
    except Exception:
        logger.debug("Dashboard cache miss (redis unavailable)", exc_info=True)
    return None


def set_cached(
    endpoint: str,
    community_id: uuid.UUID | None,
    data: dict,
    user_id: uuid.UUID | None = None,
    ttl: int = DASHBOARD_CACHE_TTL,
) -> None:
    """Store dashboard data with a TTL. Failures are silently ignored."""
    try:
        redis_client.setex(
            _cache_key(endpoint, community_id, user_id),
            ttl,
            json.dumps(data, cls=_DecimalEncoder),
        )
    except Exception:
        logger.debug("Dashboard cache set failed (redis unavailable)", exc_info=True)


def invalidate_dashboard_cache(community_id: uuid.UUID | None = None) -> None:
    """Delete all dashboard cache entries for a community.

    Called after writes that change dashboard-visible counters (e.g. visitor
    approval, delivery status change, ticket creation).  When ``community_id``
    is ``None`` the entire dashboard namespace is flushed (super-admin scope).
    """
    try:
        pattern = rkey("dashboard", "*")
        if community_id:
            pattern = rkey("dashboard", "*", str(community_id), "*")
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
    except Exception:
        logger.debug("Dashboard cache invalidation failed", exc_info=True)

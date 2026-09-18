"""Shared Redis client (sessions, cache, rate-limit counters).

Redis is **never** the source of truth (AGENTS.md §9.1). Build every key through `rkey()`
so the namespace is consistent and greppable; never hand-format a key.
"""

from __future__ import annotations

import redis

from app.core.config import settings

redis_client: redis.Redis = redis.Redis.from_url(
    str(settings.REDIS_URL),
    decode_responses=True,
    socket_timeout=1.0,
    socket_connect_timeout=1.0,
    retry_on_timeout=False,
)

_NS = "gs"


def rkey(*parts: str | int) -> str:
    """Namespaced Redis key: ``gs:<part>:<part>...``."""
    return ":".join([_NS, *(str(p) for p in parts)])

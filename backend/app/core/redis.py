"""Shared Redis client (sessions, cache, rate-limit counters)."""

from __future__ import annotations

import redis

from app.core.config import settings

redis_client: redis.Redis = redis.Redis.from_url(str(settings.REDIS_URL), decode_responses=True)

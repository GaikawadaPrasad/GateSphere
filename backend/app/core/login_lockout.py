"""Per-account login lockout (AGENTS.md §7).

Complements the IP/session sliding-window limiter (`ratelimit.py`): after
`LOGIN_LOCKOUT_ATTEMPTS` failed logins for one email inside
`LOGIN_LOCKOUT_WINDOW_SECONDS`, the account is locked for `LOGIN_LOCKOUT_SECONDS` —
even the correct password gets `429 ACCOUNT_LOCKED` until the lock expires, and a
successful login clears the counter.

Redis holds two keys per normalized email (`gs:loginfail:<email>`,
`gs:loginlock:<email>`), built with the shared `rkey` helper. **Fails open**: any
`RedisError` (or the feature being disabled) returns "not locked" — availability over
strictness, same as the rate limiter.
"""

from __future__ import annotations

from contextlib import suppress
from typing import cast

from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis import redis_client, rkey


def _keys(email: str) -> tuple[str, str]:
    ident = email.strip().lower()
    return rkey("loginfail", ident), rkey("loginlock", ident)


def lock_remaining(email: str) -> int:
    """Seconds left on the account lock, 0 when not locked (or on Redis error)."""
    if not settings.LOGIN_LOCKOUT_ENABLED:
        return 0
    _, lock = _keys(email)
    try:
        ttl = cast(int | None, redis_client.ttl(lock))
    except RedisError:
        return 0
    return max(0, ttl or 0)


def record_failure(email: str) -> int:
    """Count one failed login. Arms the lock at the threshold.

    Returns the lock duration in seconds when this failure triggered the lock,
    else 0. Fails open (0) on a Redis error.
    """
    if not settings.LOGIN_LOCKOUT_ENABLED:
        return 0
    fails, lock = _keys(email)
    window = settings.LOGIN_LOCKOUT_WINDOW_SECONDS
    try:
        if redis_client.set(fails, 1, nx=True, ex=window):
            count = 1
        else:
            count = cast(int, redis_client.incr(fails))
        if count >= settings.LOGIN_LOCKOUT_ATTEMPTS:
            redis_client.set(lock, "1", ex=settings.LOGIN_LOCKOUT_SECONDS)
            redis_client.delete(fails)
            return settings.LOGIN_LOCKOUT_SECONDS
    except RedisError:
        return 0
    return 0


def clear_failures(email: str) -> None:
    """Reset the failure counter after a successful login. Best-effort."""
    if not settings.LOGIN_LOCKOUT_ENABLED:
        return
    fails, _ = _keys(email)
    with suppress(RedisError):
        redis_client.delete(fails)

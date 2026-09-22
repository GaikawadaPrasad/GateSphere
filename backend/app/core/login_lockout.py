"""Per-account login lockout (AGENTS.md §7).

Complements the IP/session sliding-window limiter (`ratelimit.py`): after
`LOGIN_LOCKOUT_ATTEMPTS` failed logins for one email inside
`LOGIN_LOCKOUT_WINDOW_SECONDS`, the account is locked for `LOGIN_LOCKOUT_SECONDS` —
even the correct password gets `429 ACCOUNT_LOCKED` until the lock expires, and a
successful login clears the counter.

Redis holds two keys per normalized email (`gs:loginfail:<email>`,
`gs:loginlock:<email>`), built with the shared `rkey` helper. **Fails CLOSED** (M-01,
backend/REMEDIATION_LOG.md): any `RedisError` is treated as "locked" / "this failure
counted", never as "safe to let through" — an unmetered login during a Redis outage is a
worse failure mode than a temporary lockout false-positive. In practice the `auth`-class
rate limiter (`ratelimit.py`) already refuses the request with a 503 before it reaches
here on the same Redis outage; this module fails closed too as an independent second
layer, in case it's ever called from a code path that isn't behind that middleware.
"""

from __future__ import annotations

from contextlib import suppress
from typing import cast

from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis import redis_client, rkey

# Returned by `lock_remaining`/`record_failure` on a Redis error — an arbitrary but
# deliberately non-zero TTL so the caller treats the account as locked rather than clear.
_REDIS_DOWN_LOCK_SECONDS = 60


def _keys(email: str) -> tuple[str, str]:
    ident = email.strip().lower()
    return rkey("loginfail", ident), rkey("loginlock", ident)


def lock_remaining(email: str) -> int:
    """Seconds left on the account lock, 0 when not locked. Fails CLOSED: a Redis error
    is reported as locked (`_REDIS_DOWN_LOCK_SECONDS`), not as "not locked"."""
    if not settings.LOGIN_LOCKOUT_ENABLED:
        return 0
    _, lock = _keys(email)
    try:
        ttl = cast(int | None, redis_client.ttl(lock))
    except RedisError as e:
        from app.core.errors import BusinessRuleError
        raise BusinessRuleError("Login temporarily unavailable", code="SERVICE_UNAVAILABLE") from e
    return max(0, ttl or 0)


def record_failure(email: str) -> int:
    """Count one failed login. Arms the lock at the threshold.

    Returns the lock duration in seconds when this failure triggered the lock, else 0.
    Fails CLOSED: a Redis error is reported as if it triggered the lock, since the
    counter that would normally decide that is unavailable.
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
    except RedisError as e:
        from app.core.errors import BusinessRuleError
        raise BusinessRuleError("Login temporarily unavailable", code="SERVICE_UNAVAILABLE") from e


def clear_failures(email: str) -> None:
    """Reset the failure counter after a successful login. Best-effort/fail-open is
    correct here (unlike `lock_remaining`/`record_failure` above): this only runs after
    a login that already passed the fail-closed lockout check in the same request, so
    Redis was reachable moments ago — worst case a stale failure count lingers."""
    if not settings.LOGIN_LOCKOUT_ENABLED:
        return
    fails, _ = _keys(email)
    with suppress(RedisError):
        redis_client.delete(fails)

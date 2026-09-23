"""Redis sliding-window rate limiting (AGENTS.md §9.2).

One ASGI middleware. Every request is put in a **path class** (`auth`, `search`, `upload`,
`export`, `write`, `default`); each class has its own `<max>/<window seconds>` budget from
config. Identity is `user:<session-id>` when the session cookie resolves against the Redis
session cache (no DB hit), else `ip:<addr>`.

Algorithm: sliding-window **log** in a Redis sorted set — `ZREMRANGEBYSCORE` drops entries
older than the window, `ZCARD` is the current count, `ZADD` records this request, `EXPIRE`
bounds the key. All four run in one `MULTI/EXEC` pipeline.

**Fails open** for most classes: any `RedisError` (or the limiter being disabled) lets the
request through — availability over strictness. A reverse proxy is expected to add a second,
independent layer.

**Fails CLOSED for `auth` and `payment`** (M-01, backend/REMEDIATION_LOG.md): those two
classes cover login/session and money-moving endpoints, where letting an unmetered flood of
requests through during a Redis outage (unlimited login attempts, unlimited payment/refund
submissions) is a worse failure mode than refusing that one class of request with a 503
until Redis recovers. Every other class (search/upload/export/write/default) keeps the
original fail-open behavior — those are throughput/abuse controls, not the last line of
defense against credential stuffing or financial abuse.
"""

from __future__ import annotations

import asyncio
import time
import uuid

from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.redis import redis_client, rkey

_SESSION_PREFIX = "session:"  # mirrors app.core.security (cache-only read here)

_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_EXEMPT_PATHS = frozenset({"/", "/healthz", "/readyz", "/docs", "/redoc", "/openapi.json"})

# Classes where a Redis outage must not silently let the request through (M-01).
_FAIL_CLOSED_CLASSES = frozenset({"auth", "payment"})

# Money-moving paths (create payment, refund) — GET/list/receipt stays out of this class
# since those aren't the thing M-01 is protecting against.
_PAYMENT_PATH_MARKERS = ("/billing/payments",)


_UNIT_SECONDS = {
    "second": 1,
    "sec": 1,
    "s": 1,
    "minute": 60,
    "min": 60,
    "m": 60,
    "hour": 3600,
    "h": 3600,
}


def _parse(spec: str) -> tuple[int, int]:
    """`<max>/<window>` where window is seconds (`5/60`) or a unit (`5/minute`)."""
    count, _, window = spec.strip().partition("/")
    window = window.strip().lower() or "60"
    return int(count), int(window) if window.isdigit() else _UNIT_SECONDS.get(window, 60)


def classify(request: Request) -> str:
    path = request.url.path
    method = request.method
    if path.endswith("/auth/me"):
        # PATCH /auth/me is a profile update, not an auth action — use write bucket
        if method not in _SAFE_METHODS:
            return "write"
        return "default"
    if path.startswith("/api/v1/auth/") or path.endswith("/login"):
        return "auth"
    if (
        method not in _SAFE_METHODS
        and not path.endswith("/receipt")
        and any(marker in path for marker in _PAYMENT_PATH_MARKERS)
    ):
        return "payment"
    if path.endswith(".csv") or "/export" in path or path.endswith("/receipt"):
        return "export"
    if path.startswith("/api/v1/uploads"):
        return "upload"
    if request.query_params.get("q") is not None or "/search" in path:
        return "search"
    if method not in _SAFE_METHODS:
        return "write"
    return "default"


def _limits() -> dict[str, tuple[int, int]]:
    return {
        "auth": _parse(settings.RATE_LIMIT_LOGIN),
        "search": _parse(settings.RATE_LIMIT_SEARCH),
        "upload": _parse(settings.RATE_LIMIT_UPLOAD),
        "export": _parse(settings.RATE_LIMIT_EXPORT),
        "write": _parse(settings.RATE_LIMIT_WRITE),
        "payment": _parse(settings.RATE_LIMIT_PAYMENT),
        "default": _parse(settings.RATE_LIMIT_DEFAULT),
    }


def _identity(request: Request) -> str:
    """`user:<session-id>` from the Redis session cache (no DB), else `ip:<addr>`."""
    for name, value in request.cookies.items():
        if name == "gs_session" or (name.startswith("gatesphere_") and name.endswith("_session")):
            try:
                raw = redis_client.get(_SESSION_PREFIX + _hash(value))
            except RedisError:
                raw = None
            if raw:
                import json

                try:
                    return "user:" + json.loads(raw)["user_id"]
                except (ValueError, KeyError):
                    pass
    client = request.client
    return f"ip:{client.host}" if client else "ip:unknown"


def _hash(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode()).hexdigest()


def _too_many(retry_after: int, request_id: str | None) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(retry_after), "X-Request-ID": request_id or ""},
        content={
            "success": False,
            "message": "Too many requests — slow down and try again shortly.",
            "data": None,
            "meta": None,
            "error": {"code": "RATE_LIMITED"},
        },
    )


def _unavailable(request_id: str | None) -> JSONResponse:
    """M-01: the fail-closed response for `auth`/`payment` when Redis itself is down —
    distinct from `_too_many` (429, a real client that hit its budget). This is a 503
    because the *server's* ability to enforce the limit is what's unavailable."""
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": "5", "X-Request-ID": request_id or ""},
        content={
            "success": False,
            "message": "This action is temporarily unavailable — try again shortly.",
            "data": None,
            "meta": None,
            "error": {"code": "RATE_LIMIT_UNAVAILABLE"},
        },
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if not settings.RATE_LIMIT_ENABLED or request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        cls = classify(request)
        max_n, window = _limits()[cls]

        def _check_rate_limit() -> int:
            ident = _identity(request)
            key = rkey("rl", cls, ident)
            now = time.time()
            member = f"{now}:{uuid.uuid4().hex}"
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zcard(key)
            pipe.zadd(key, {member: now})
            pipe.expire(key, window)
            _, used, _, _ = pipe.execute()
            return int(used)

        try:
            used = await asyncio.to_thread(_check_rate_limit)
        except (RedisError, Exception):
            if cls in ("auth", "payment"):
                return _unavailable(getattr(request.state, "request_id", None))
            return await call_next(request)

        if used >= max_n:
            resp: Response = _too_many(window, getattr(request.state, "request_id", None))
        else:
            resp = await call_next(request)

        resp.headers["X-RateLimit-Limit"] = str(max_n)
        resp.headers["X-RateLimit-Remaining"] = str(max(0, max_n - used - 1))
        return resp

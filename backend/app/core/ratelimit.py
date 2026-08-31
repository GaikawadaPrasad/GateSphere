"""Redis sliding-window rate limiting (AGENTS.md §9.2).

One ASGI middleware. Every request is put in a **path class** (`auth`, `search`, `upload`,
`export`, `write`, `default`); each class has its own `<max>/<window seconds>` budget from
config. Identity is `user:<session-id>` when the session cookie resolves against the Redis
session cache (no DB hit), else `ip:<addr>`.

Algorithm: sliding-window **log** in a Redis sorted set — `ZREMRANGEBYSCORE` drops entries
older than the window, `ZCARD` is the current count, `ZADD` records this request, `EXPIRE`
bounds the key. All four run in one `MULTI/EXEC` pipeline.

**Fails open**: any `RedisError` (or the limiter being disabled) lets the request through —
availability over strictness. A reverse proxy is expected to add a second, independent layer.
"""

from __future__ import annotations

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
    if path.startswith("/api/v1/auth/") or path.endswith("/login"):
        return "auth"
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


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        if not settings.RATE_LIMIT_ENABLED or request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        cls = classify(request)
        max_n, window = _limits()[cls]
        ident = _identity(request)
        key = rkey("rl", cls, ident)
        now = time.time()

        try:
            member = f"{now}:{uuid.uuid4().hex}"
            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zcard(key)
            pipe.zadd(key, {member: now})
            pipe.expire(key, window)
            _, used, _, _ = pipe.execute()
        except RedisError:
            return await call_next(request)  # fail open

        if used >= max_n:
            resp: Response = _too_many(window, getattr(request.state, "request_id", None))
        else:
            resp = await call_next(request)

        resp.headers["X-RateLimit-Limit"] = str(max_n)
        resp.headers["X-RateLimit-Remaining"] = str(max(0, max_n - used - 1))
        return resp

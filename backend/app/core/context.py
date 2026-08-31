"""`RequestContext` — the framework-agnostic slice of an HTTP request that the service
layer is allowed to see (AGENTS.md §2: a service must not import `fastapi` / `Request`).

The router dependency builds one with `RequestContext.from_request(request)` and passes it
down. Services thread it into `record_audit_async(ctx=...)` and `notif_events.emit(ctx=...)`
for audit / notification context. It carries no behaviour and no framework types.

`auth` and `onboarding` are the two modules that still take the real `Request`/`Response`
directly — they read and write session cookies.
"""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    ip: str | None = None
    user_agent: str | None = None
    request_id: str | None = None
    session_id: str | None = None
    role_slug: str | None = None

    @classmethod
    def from_request(cls, request: object | None) -> RequestContext | None:
        if request is None:
            return None
        state = getattr(request, "state", None)
        client = getattr(request, "client", None)
        headers = getattr(request, "headers", {}) or {}
        return cls(
            ip=_valid_ip(getattr(client, "host", None)),
            user_agent=(headers.get("user-agent") or None),
            request_id=getattr(state, "request_id", None),
            session_id=getattr(state, "session_id", None),
            role_slug=getattr(state, "session_role", None),
        )


def _valid_ip(host: str | None) -> str | None:
    if not host:
        return None
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        return None

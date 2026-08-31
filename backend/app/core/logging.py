"""Structured JSON logging + request correlation IDs."""

from __future__ import annotations

import logging
import re
import sys
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Paths that carry a bearer secret in a segment — keep it out of every log sink (R-1).
_SECRET_PATH = re.compile(r"(/api/v1/invitations/)[^/?\s]+")


def redact_path(path: str) -> str:
    return _SECRET_PATH.sub(r"\1<redacted>", path)


class _AccessLogRedactor(logging.Filter):
    """Rewrites the request line in `uvicorn.access` records so an invite token never
    lands in the access log."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.args and isinstance(record.args, tuple) and len(record.args) >= 3:
            record.args = tuple(redact_path(a) if isinstance(a, str) else a for a in record.args)
        record.msg = redact_path(record.msg) if isinstance(record.msg, str) else record.msg
        return True


def configure_logging(debug: bool) -> None:
    logging.basicConfig(
        format="%(message)s", stream=sys.stdout, level=logging.DEBUG if debug else logging.INFO
    )
    logging.getLogger("uvicorn.access").addFilter(_AccessLogRedactor())
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if debug else logging.INFO
        ),
    )


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        cid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(
            request_id=cid, path=redact_path(request.url.path), method=request.method
        )
        try:
            response = await call_next(request)
        finally:
            structlog.contextvars.clear_contextvars()
        response.headers["X-Request-ID"] = cid
        return response

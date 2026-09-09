"""FastAPI application factory."""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import CorrelationIdMiddleware, configure_logging
from app.core.ratelimit import RateLimitMiddleware
from app.core.responses import ok

log = structlog.get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Baseline response hardening headers (NFR security). The API serves JSON only and is
    same-origin with the Next.js app, so the CSP is deliberately strict."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        path = request.url.path.rstrip("/")
        if path in ("/docs", "/redoc") or request.url.path.startswith("/openapi"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "connect-src 'self'; "
                "frame-ancestors 'none'"
            )
        else:
            response.headers.setdefault(
                "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
            )
        if settings.COOKIE_SECURE:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response


def create_app() -> FastAPI:
    configure_logging(settings.DEBUG)
    docs = settings.docs_enabled
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if docs else None,
    )

    register_exception_handlers(app)

    # Middleware runs bottom-up on the request: TrustedHost → CORS → CorrelationId →
    # RateLimit → SecurityHeaders → route.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if settings.allowed_hosts != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/", tags=["ops"], summary="Service metadata")
    def root() -> dict:
        return ok(
            {
                "name": settings.PROJECT_NAME,
                "service": "gatesphere-backend",
                "version": app.version,
                "environment": settings.ENVIRONMENT,
                "api_prefix": settings.API_V1_PREFIX,
                "docs": "/docs",
                "openapi": f"{settings.API_V1_PREFIX}/openapi.json",
                "health": {"live": "/healthz", "ready": "/readyz"},
            }
        )

    @app.get("/healthz", tags=["ops"], summary="Liveness probe")
    def healthz() -> dict:
        return ok(
            {
                "name": settings.PROJECT_NAME,
                "version": app.version,
                "environment": settings.ENVIRONMENT,
            },
            message="alive",
        )

    @app.get("/readyz", tags=["ops"], summary="Readiness probe (checks dependencies)")
    def readyz() -> JSONResponse:
        from sqlalchemy import text

        from app.core.redis import redis_client
        from app.db.session import engine

        checks: dict[str, str] = {}
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error: {exc.__class__.__name__}"
        try:
            redis_client.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {exc.__class__.__name__}"

        ready = all(v == "ok" for v in checks.values())
        return JSONResponse(
            status_code=200 if ready else 503,
            content={
                "success": ready,
                "message": "ready" if ready else "degraded",
                "data": {"checks": checks},
                "meta": None,
            },
        )

    log.info("app.started", env=settings.ENVIRONMENT)
    return app


app = create_app()

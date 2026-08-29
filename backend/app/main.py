"""FastAPI application factory."""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import CorrelationIdMiddleware, configure_logging
from app.core.responses import ok
from app.modules.auth.router import limiter

log = structlog.get_logger(__name__)


def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "message": "Too many requests — slow down and try again shortly.",
            "data": None,
            "error": {"code": "RATE_LIMITED"},
        },
    )


def create_app() -> FastAPI:
    configure_logging(settings.DEBUG)
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        docs_url="/docs",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
    register_exception_handlers(app)

    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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

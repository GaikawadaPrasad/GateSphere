"""Domain error hierarchy + central exception handlers.

Every error response leaves the API in the canonical envelope
(AGENTS.md §6, docs/platform/api-contract.md):

    {
      "success": false,
      "message": "<safe, displayable>",
      "data": null,
      "error": { "code": "...", "fields": { "<field>": "<msg>" } }
    }

Handlers never leak a stack trace, SQL, secret, or filesystem path.
"""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger(__name__)


class AppError(Exception):
    """Base class for all deliberate, client-facing errors."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BAD_REQUEST"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.fields = fields


class AuthError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "NOT_AUTHENTICATED"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class NotFoundError(AppError):
    """Also used for cross-tenant access — never distinguished from a real 404."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class BusinessRuleError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "BUSINESS_RULE_VIOLATION"


def _envelope(code: str, message: str, fields: dict[str, str] | None = None) -> dict:
    error: dict = {"code": code}
    if fields:
        error["fields"] = fields
    return {"success": False, "message": message, "data": None, "meta": None, "error": error}


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.fields),
            headers={"X-Request-ID": _request_id(request) or ""},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields = {
            ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path")): err["msg"]
            for err in exc.errors()
        }
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("VALIDATION_ERROR", "Request validation failed", fields),
        )

    @app.exception_handler(ValidationError)
    async def _pydantic(request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("VALIDATION_ERROR", "Response validation failed"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: "NOT_AUTHENTICATED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
        }.get(exc.status_code, "HTTP_ERROR")
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, detail))

    @app.exception_handler(IntegrityError)
    async def _integrity(request: Request, exc: IntegrityError) -> JSONResponse:
        """A DB constraint fired that the service layer did not pre-check (usually a race).
        Map to a client-correctable status; never leak the SQL / constraint internals."""
        sqlstate = getattr(getattr(exc, "orig", None), "sqlstate", None)
        mapping = {
            "23505": (status.HTTP_409_CONFLICT, "CONFLICT", "That record already exists."),
            "23503": (status.HTTP_409_CONFLICT, "FK_VIOLATION", "A referenced record is missing."),
            "23514": (status.HTTP_400_BAD_REQUEST, "CHECK_VIOLATION", "A value is out of range."),
            "23502": (status.HTTP_400_BAD_REQUEST, "NOT_NULL", "A required value is missing."),
        }
        code_status, code, msg = mapping.get(
            sqlstate or "",
            (status.HTTP_409_CONFLICT, "CONFLICT", "The change conflicts with an existing record."),
        )
        log.warning("db.integrity", sqlstate=sqlstate, request_id=_request_id(request))
        return JSONResponse(status_code=code_status, content=_envelope(code, msg))

    @app.exception_handler(SQLAlchemyError)
    async def _sqlalchemy(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        name = exc.__class__.__name__
        if name in ("StaleDataError", "ConcurrentModificationError"):
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=_envelope("STALE_DATA", "The record changed — reload and try again."),
            )
        log.exception("db.error", error=name, request_id=_request_id(request))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("INTERNAL_ERROR", "A database error occurred."),
        )

    @app.exception_handler(Exception)
    async def _catch_all(request: Request, exc: Exception) -> JSONResponse:
        log.exception(
            "unhandled.error", error=exc.__class__.__name__, request_id=_request_id(request)
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("INTERNAL_ERROR", "An unexpected error occurred."),
        )

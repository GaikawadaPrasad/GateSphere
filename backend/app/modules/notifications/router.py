"""API router for the Notification Engine module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/notifications", tags=["Notification Engine"])


@router.get("/health", summary="Notification Engine module liveness")
async def module_health() -> dict:
    return {"module": "notifications", "status": "ok"}


# TODO(notifications): implement endpoints per docs/backend/modules/notifications/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

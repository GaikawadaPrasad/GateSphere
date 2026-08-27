"""API router for the Visitor Management module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/visitors", tags=["Visitor Management"])


@router.get("/health", summary="Visitor Management module liveness")
async def module_health() -> dict:
    return {"module": "visitors", "status": "ok"}


# TODO(visitors): implement endpoints per docs/backend/modules/visitors/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

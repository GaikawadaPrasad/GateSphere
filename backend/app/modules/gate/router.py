"""API router for the Gate Operations module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/gate", tags=["Gate Operations"])


@router.get("/health", summary="Gate Operations module liveness")
async def module_health() -> dict:
    return {"module": "gate", "status": "ok"}


# TODO(gate): implement endpoints per docs/backend/modules/gate/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

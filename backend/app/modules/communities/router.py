"""API router for the Community & Property module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/communities", tags=["Community & Property"])


@router.get("/health", summary="Community & Property module liveness")
async def module_health() -> dict:
    return {"module": "communities", "status": "ok"}


# TODO(communities): implement endpoints per docs/backend/modules/communities/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

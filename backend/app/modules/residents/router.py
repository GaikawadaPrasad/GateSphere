"""API router for the Residents module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/residents", tags=["Residents"])


@router.get("/health", summary="Residents module liveness")
async def module_health() -> dict:
    return {
        "success": True,
        "message": "OK",
        "meta": None,
        "data": {"module": "residents", "status": "ok"},
    }


# TODO(residents): implement endpoints per docs/backend/modules/residents/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

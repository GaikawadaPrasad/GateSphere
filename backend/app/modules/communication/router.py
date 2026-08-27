"""API router for the Community Communication module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/communication", tags=["Community Communication"])


@router.get("/health", summary="Community Communication module liveness")
async def module_health() -> dict:
    return {
        "success": True,
        "message": "OK",
        "meta": None,
        "data": {"module": "communication", "status": "ok"},
    }


# TODO(communication): implement endpoints per docs/backend/modules/communication/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

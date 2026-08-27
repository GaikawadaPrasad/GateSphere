"""API router for the Vehicle, Parking & Violations module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/vehicles", tags=["Vehicle, Parking & Violations"])


@router.get("/health", summary="Vehicle, Parking & Violations module liveness")
async def module_health() -> dict:
    return {
        "success": True,
        "message": "OK",
        "meta": None,
        "data": {"module": "vehicles", "status": "ok"},
    }


# TODO(vehicles): implement endpoints per docs/backend/modules/vehicles/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

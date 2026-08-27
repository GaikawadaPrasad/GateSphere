"""API router for the Amenity Booking module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/amenities", tags=["Amenity Booking"])


@router.get("/health", summary="Amenity Booking module liveness")
async def module_health() -> dict:
    return {"module": "amenities", "status": "ok"}


# TODO(amenities): implement endpoints per docs/backend/modules/amenities/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

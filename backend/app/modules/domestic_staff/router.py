"""API router for the Domestic Staff module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/domestic_staff", tags=["Domestic Staff"])


@router.get("/health", summary="Domestic Staff module liveness")
async def module_health() -> dict:
    return {"module": "domestic_staff", "status": "ok"}


# TODO(domestic_staff): implement endpoints per docs/backend/modules/domestic_staff/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

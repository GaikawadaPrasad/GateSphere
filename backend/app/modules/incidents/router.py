"""API router for the Emergency & Incident Management module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/incidents", tags=["Emergency & Incident Management"])


@router.get("/health", summary="Emergency & Incident Management module liveness")
async def module_health() -> dict:
    return {"module": "incidents", "status": "ok"}


# TODO(incidents): implement endpoints per docs/backend/modules/incidents/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

"""API router for the Complaint & Service Desk module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/complaints", tags=["Complaint & Service Desk"])


@router.get("/health", summary="Complaint & Service Desk module liveness")
async def module_health() -> dict:
    return {"module": "complaints", "status": "ok"}


# TODO(complaints): implement endpoints per docs/backend/modules/complaints/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

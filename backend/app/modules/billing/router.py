"""API router for the Maintenance & Billing module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/billing", tags=["Maintenance & Billing"])


@router.get("/health", summary="Maintenance & Billing module liveness")
async def module_health() -> dict:
    return {"module": "billing", "status": "ok"}


# TODO(billing): implement endpoints per docs/backend/modules/billing/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

"""API router for the Dashboards & Reports module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/dashboards", tags=["Dashboards & Reports"])


@router.get("/health", summary="Dashboards & Reports module liveness")
async def module_health() -> dict:
    return {
        "success": True,
        "message": "OK",
        "meta": None,
        "data": {"module": "dashboards", "status": "ok"},
    }


# TODO(dashboards): implement endpoints per docs/backend/modules/dashboards/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

"""API router for the Users & RBAC module.

Layer: HTTP boundary only. Validate input, resolve the current session/permission
dependency, delegate to the service layer, format the response. No business logic here.
"""

from fastapi import APIRouter

from app.core.security import require_auth  # noqa: F401

router = APIRouter(prefix="/users", tags=["Users & RBAC"])


@router.get("/health", summary="Users & RBAC module liveness")
async def module_health() -> dict:
    return {
        "success": True,
        "message": "OK",
        "meta": None,
        "data": {"module": "users", "status": "ok"},
    }


# TODO(users): implement endpoints per docs/backend/modules/users/README.md
# Every write endpoint MUST: enforce permission, validate payload, run in a
# transaction, emit audit + notification events where applicable.

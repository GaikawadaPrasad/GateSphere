"""User & Role management API (FR-02). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `users:{view,create,update,delete}`.
Contract: docs/backend/api/users.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.users import schemas
from app.modules.users.deps import user_service
from app.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["Users & RBAC"])

VIEW = Depends(require_permission_async("users:view"))
CREATE = Depends(require_permission_async("users:create"))
UPDATE = Depends(require_permission_async("users:update"))
Svc = UserService


@router.get("/health", summary="Users & RBAC module liveness")
async def module_health() -> dict:
    return ok({"module": "users", "status": "ok"})


@router.get("/roles", response_model=Envelope[list[schemas.RoleRead]], dependencies=[VIEW])
async def list_roles(svc: Svc = Depends(user_service)) -> dict:
    return ok(await svc.list_roles())


@router.get("", response_model=Envelope[list[schemas.UserRead]], dependencies=[VIEW])
async def list_users(
    q: str | None = None,
    role_slug: str | None = None,
    community_id: uuid.UUID | None = None,
    active: bool | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(user_service),
) -> dict:
    rows, total = await svc.list_users(
        q=q,
        role_slug=role_slug,
        community_id=community_id,
        active=active,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated([svc.to_read(u) for u in rows], total=total, params=params)


@router.post(
    "",
    response_model=Envelope[schemas.UserRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_user(payload: schemas.UserCreate, svc: Svc = Depends(user_service)) -> dict:
    return ok(svc.to_read(await svc.create_user(payload)), message="User created")


@router.get("/{user_id}", response_model=Envelope[schemas.UserRead], dependencies=[VIEW])
async def get_user(user_id: uuid.UUID, svc: Svc = Depends(user_service)) -> dict:
    return ok(svc.to_read(await svc.get_user(user_id)))


@router.patch("/{user_id}", response_model=Envelope[schemas.UserRead], dependencies=[UPDATE])
async def update_user(
    user_id: uuid.UUID, payload: schemas.UserUpdate, svc: Svc = Depends(user_service)
) -> dict:
    return ok(svc.to_read(await svc.update_user(user_id, payload)), message="Updated")


@router.post(
    "/{user_id}/roles",
    response_model=Envelope[schemas.RoleGrantRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
async def grant_role(
    user_id: uuid.UUID, payload: schemas.RoleGrantIn, svc: Svc = Depends(user_service)
) -> dict:
    ur = await svc.grant_role(user_id, payload)
    return ok(svc._role_grant(ur), message="Role granted")


@router.delete(
    "/{user_id}/roles/{grant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[UPDATE],
)
async def revoke_role(
    user_id: uuid.UUID, grant_id: uuid.UUID, svc: Svc = Depends(user_service)
) -> Response:
    await svc.revoke_role(user_id, grant_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Notifications API (FR-15). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `notifications:{view,create}`. Every user reads their own inbox
and manages their own preferences; `notifications:create` gates dispatch + templates.
Contract: docs/backend/api/notifications.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.notifications import schemas
from app.modules.notifications.deps import notification_service
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])

VIEW = Depends(require_permission_async("notifications:view"))
CREATE = Depends(require_permission_async("notifications:create"))
Svc = NotificationService


@router.get("/health", summary="Notifications module liveness")
async def module_health() -> dict:
    return ok({"module": "notifications", "status": "ok"})


# --- preferences (self) ------------------------------------------- #
@router.get(
    "/me/preferences",
    response_model=Envelope[list[schemas.PreferenceRead]],
    dependencies=[VIEW],
)
async def my_preferences(svc: Svc = Depends(notification_service)) -> dict:
    return ok([schemas.PreferenceRead.model_validate(p) for p in await svc.my_preferences()])


@router.get(
    "/preferences",
    response_model=Envelope[list[schemas.PreferenceRead]],
    dependencies=[VIEW],
)
async def my_preferences_alias(svc: Svc = Depends(notification_service)) -> dict:
    return ok([schemas.PreferenceRead.model_validate(p) for p in await svc.my_preferences()])


@router.put("/me/preferences", response_model=Envelope[schemas.PreferenceRead], dependencies=[VIEW])
async def set_preference(
    payload: schemas.PreferenceUpsert, svc: Svc = Depends(notification_service)
) -> dict:
    return ok(
        schemas.PreferenceRead.model_validate(await svc.set_preference(payload)), message="Saved"
    )


@router.put("/preferences", response_model=Envelope[schemas.PreferenceRead], dependencies=[VIEW])
async def set_preference_alias(
    payload: schemas.PreferenceUpsert, svc: Svc = Depends(notification_service)
) -> dict:
    return ok(
        schemas.PreferenceRead.model_validate(await svc.set_preference(payload)), message="Saved"
    )


# --- templates + dispatch (admin) ------------------------------- #
@router.get(
    "/templates", response_model=Envelope[list[schemas.TemplateRead]], dependencies=[CREATE]
)
async def list_templates(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(notification_service)
) -> dict:
    return ok(
        [
            schemas.TemplateRead.model_validate(t)
            for t in await svc.list_templates(community_id=community_id)
        ]
    )


@router.put("/templates", response_model=Envelope[schemas.TemplateRead], dependencies=[CREATE])
async def upsert_template(
    payload: schemas.TemplateUpsert,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(notification_service),
) -> dict:
    return ok(
        schemas.TemplateRead.model_validate(
            await svc.upsert_template(payload, community_id=community_id)
        ),
        message="Saved",
    )


@router.post(
    "/dispatch",
    response_model=Envelope[schemas.NotificationRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def dispatch(payload: schemas.DispatchIn, svc: Svc = Depends(notification_service)) -> dict:
    return ok(
        schemas.NotificationRead.model_validate(await svc.dispatch(payload)), message="Dispatched"
    )


# --- my inbox ------------------------------------------------------ #
@router.get("", response_model=Envelope[list[schemas.NotificationRead]], dependencies=[VIEW])
async def list_mine(
    unread_only: bool = False,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(notification_service),
) -> dict:
    rows, total = await svc.list_mine(
        unread_only=unread_only, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.NotificationRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post("/read-all", dependencies=[VIEW])
@router.patch("/read-all", dependencies=[VIEW])
@router.post("/mark-all-read", dependencies=[VIEW])
@router.patch("/mark-all-read", dependencies=[VIEW])
async def mark_all_read(svc: Svc = Depends(notification_service)) -> dict:
    return ok({"marked": await svc.mark_all_read()}, message="Marked")


@router.get(
    "/{notification_id}", response_model=Envelope[schemas.NotificationRead], dependencies=[VIEW]
)
async def get_mine(notification_id: uuid.UUID, svc: Svc = Depends(notification_service)) -> dict:
    return ok(schemas.NotificationRead.model_validate(await svc.get_mine(notification_id)))


@router.post(
    "/{notification_id}/read",
    response_model=Envelope[schemas.NotificationRead],
    dependencies=[VIEW],
)
@router.patch(
    "/{notification_id}/read",
    response_model=Envelope[schemas.NotificationRead],
    dependencies=[VIEW],
)
@router.patch(
    "/{notification_id}",
    response_model=Envelope[schemas.NotificationRead],
    dependencies=[VIEW],
)
async def mark_read(notification_id: uuid.UUID, svc: Svc = Depends(notification_service)) -> dict:
    return ok(
        schemas.NotificationRead.model_validate(await svc.mark_read(notification_id)),
        message="Read",
    )

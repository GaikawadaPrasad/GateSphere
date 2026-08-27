"""Communication & Broadcasts API (FR-12). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `communication:{view,create,update,approve}`.
Contract: docs/backend/api/communication.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission
from app.modules.communication import schemas
from app.modules.communication.deps import communication_service
from app.modules.communication.service import CommunicationService

router = APIRouter(prefix="/communication", tags=["Communication & Broadcasts"])

VIEW = Depends(require_permission("communication:view"))
CREATE = Depends(require_permission("communication:create"))
UPDATE = Depends(require_permission("communication:update"))
APPROVE = Depends(require_permission("communication:approve"))

Svc = CommunicationService


@router.get("/health", summary="Communication & Broadcasts module liveness")
async def module_health() -> dict:
    return ok({"module": "communication", "status": "ok"})


# --- announcements ------------------------------------------------- #
@router.get(
    "/announcements",
    response_model=Envelope[list[schemas.AnnouncementRead]],
    dependencies=[VIEW],
)
def list_announcements(
    community_id: uuid.UUID | None = None,
    published_only: bool = True,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(communication_service),
) -> dict:
    rows, total = svc.list_announcements(
        community_id=community_id,
        published_only=published_only,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.AnnouncementRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/announcements",
    response_model=Envelope[schemas.AnnouncementRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_announcement(
    payload: schemas.AnnouncementCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(communication_service),
) -> dict:
    return ok(
        schemas.AnnouncementRead.model_validate(
            svc.create_announcement(payload, community_id=community_id)
        ),
        message="Draft created",
    )


@router.get(
    "/announcements/{announcement_id}",
    response_model=Envelope[schemas.AnnouncementRead],
    dependencies=[VIEW],
)
def get_announcement(announcement_id: uuid.UUID, svc: Svc = Depends(communication_service)) -> dict:
    return ok(schemas.AnnouncementRead.model_validate(svc.get_announcement(announcement_id)))


@router.patch(
    "/announcements/{announcement_id}",
    response_model=Envelope[schemas.AnnouncementRead],
    dependencies=[UPDATE],
)
def update_announcement(
    announcement_id: uuid.UUID,
    payload: schemas.AnnouncementUpdate,
    svc: Svc = Depends(communication_service),
) -> dict:
    return ok(
        schemas.AnnouncementRead.model_validate(svc.update_announcement(announcement_id, payload)),
        message="Updated",
    )


@router.post(
    "/announcements/{announcement_id}/publish",
    response_model=Envelope[schemas.AnnouncementRead],
    dependencies=[APPROVE],
)
def publish_announcement(
    announcement_id: uuid.UUID, svc: Svc = Depends(communication_service)
) -> dict:
    return ok(
        schemas.AnnouncementRead.model_validate(svc.publish_announcement(announcement_id)),
        message="Published",
    )


@router.post(
    "/announcements/{announcement_id}/expire",
    response_model=Envelope[schemas.AnnouncementRead],
    dependencies=[UPDATE],
)
def expire_announcement(
    announcement_id: uuid.UUID, svc: Svc = Depends(communication_service)
) -> dict:
    return ok(
        schemas.AnnouncementRead.model_validate(svc.expire_announcement(announcement_id)),
        message="Expired",
    )


# --- polls ------------------------------------------------------- #
@router.post(
    "/polls",
    response_model=Envelope[schemas.PollRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_poll(payload: schemas.PollCreate, svc: Svc = Depends(communication_service)) -> dict:
    return ok(schemas.PollRead.model_validate(svc.create_poll(payload)), message="Poll created")


@router.get("/polls/{poll_id}", response_model=Envelope[schemas.PollRead], dependencies=[VIEW])
def get_poll(poll_id: uuid.UUID, svc: Svc = Depends(communication_service)) -> dict:
    return ok(schemas.PollRead.model_validate(svc.get_poll(poll_id)))


@router.post(
    "/polls/{poll_id}/status",
    response_model=Envelope[schemas.PollRead],
    dependencies=[APPROVE],
)
def set_poll_status(
    poll_id: uuid.UUID, new_status: str, svc: Svc = Depends(communication_service)
) -> dict:
    return ok(
        schemas.PollRead.model_validate(svc.set_poll_status(poll_id, new_status)),
        message="Updated",
    )


@router.post(
    "/polls/{poll_id}/vote",
    response_model=Envelope[schemas.PollResults],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
def vote(
    poll_id: uuid.UUID, payload: schemas.VoteIn, svc: Svc = Depends(communication_service)
) -> dict:
    svc.vote(poll_id, payload)
    return ok(svc.results(poll_id), message="Vote recorded")


@router.get(
    "/polls/{poll_id}/results",
    response_model=Envelope[schemas.PollResults],
    dependencies=[VIEW],
)
def poll_results(poll_id: uuid.UUID, svc: Svc = Depends(communication_service)) -> dict:
    return ok(svc.results(poll_id))


# --- resident groups ------------------------------------------- #
def _group_read(grp, count: int) -> schemas.GroupRead:
    return schemas.GroupRead(
        id=grp.id,
        created_at=grp.created_at,
        updated_at=grp.updated_at,
        community_id=grp.community_id,
        name=grp.name,
        description=grp.description,
        created_by_user_id=grp.created_by_user_id,
        is_active=grp.is_active,
        member_count=count,
    )


@router.get("/groups", response_model=Envelope[list[schemas.GroupRead]], dependencies=[VIEW])
def list_groups(
    community_id: uuid.UUID | None = None, svc: Svc = Depends(communication_service)
) -> dict:
    return ok([_group_read(g, n) for g, n in svc.list_groups(community_id=community_id)])


@router.post(
    "/groups",
    response_model=Envelope[schemas.GroupRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
def create_group(
    payload: schemas.GroupCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(communication_service),
) -> dict:
    return ok(
        _group_read(svc.create_group(payload, community_id=community_id), 0),
        message="Group created",
    )


@router.patch(
    "/groups/{group_id}", response_model=Envelope[schemas.GroupRead], dependencies=[UPDATE]
)
def update_group(
    group_id: uuid.UUID,
    payload: schemas.GroupUpdate,
    svc: Svc = Depends(communication_service),
) -> dict:
    grp = svc.update_group(group_id, payload)
    return ok(_group_read(grp, len(grp.members)), message="Updated")


@router.get(
    "/groups/{group_id}/members",
    response_model=Envelope[list[schemas.GroupMemberRead]],
    dependencies=[VIEW],
)
def list_members(group_id: uuid.UUID, svc: Svc = Depends(communication_service)) -> dict:
    return ok([schemas.GroupMemberRead.model_validate(m) for m in svc.list_members(group_id)])


@router.post(
    "/groups/{group_id}/members",
    response_model=Envelope[schemas.GroupMemberRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[UPDATE],
)
def add_member(
    group_id: uuid.UUID,
    payload: schemas.GroupMemberIn,
    svc: Svc = Depends(communication_service),
) -> dict:
    return ok(
        schemas.GroupMemberRead.model_validate(svc.add_member(group_id, payload)),
        message="Added",
    )


@router.delete(
    "/groups/{group_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[UPDATE],
)
def remove_member(
    group_id: uuid.UUID, member_id: uuid.UUID, svc: Svc = Depends(communication_service)
) -> Response:
    svc.remove_member(group_id, member_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

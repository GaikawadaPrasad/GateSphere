"""Domestic Staff API (FR-06). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `domestic_staff:{view,create,update,approve}`.
Contract: docs/backend/api/domestic-staff.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_permission_async
from app.modules.domestic_staff import schemas
from app.modules.domestic_staff.deps import domestic_staff_service
from app.modules.domestic_staff.service import DomesticStaffService

router = APIRouter(prefix="/domestic-staff", tags=["Domestic Staff"])

VIEW = Depends(require_permission_async("domestic_staff:view"))
CREATE = Depends(require_permission_async("domestic_staff:create"))
UPDATE = Depends(require_permission_async("domestic_staff:update"))
APPROVE = Depends(require_permission_async("domestic_staff:approve"))

Svc = DomesticStaffService


@router.get("/health", summary="Domestic Staff module liveness")
async def module_health() -> dict:
    return ok({"module": "domestic_staff", "status": "ok"})


# --- assignments ------------------------------------------------------- #
@router.get(
    "/assignments", response_model=Envelope[list[schemas.AssignmentRead]], dependencies=[VIEW]
)
async def list_assignments(
    staff_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    active_only: bool = False,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(domestic_staff_service),
) -> dict:
    rows, total = await svc.list_assignments(
        staff_id=staff_id,
        unit_id=unit_id,
        active_only=active_only,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.AssignmentRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/assignments",
    response_model=Envelope[schemas.AssignmentRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[APPROVE],
)
async def assign_unit(
    payload: schemas.AssignmentCreate, svc: Svc = Depends(domestic_staff_service)
) -> dict:
    return ok(
        schemas.AssignmentRead.model_validate(await svc.assign_unit(payload)), message="Assigned"
    )


@router.post(
    "/assignments/{assignment_id}/end",
    response_model=Envelope[schemas.AssignmentRead],
    dependencies=[UPDATE],
)
async def end_assignment(
    assignment_id: uuid.UUID, svc: Svc = Depends(domestic_staff_service)
) -> dict:
    return ok(
        schemas.AssignmentRead.model_validate(await svc.end_assignment(assignment_id)),
        message="Ended",
    )


# --- attendance --------------------------------------------------- #
@router.get(
    "/attendance", response_model=Envelope[list[schemas.AttendanceRead]], dependencies=[VIEW]
)
async def list_attendance(
    community_id: uuid.UUID | None = None,
    staff_id: uuid.UUID | None = None,
    open_only: bool = False,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(domestic_staff_service),
) -> dict:
    rows, total = await svc.list_attendance(
        community_id=community_id,
        staff_id=staff_id,
        open_only=open_only,
        offset=params.offset,
        limit=params.page_size,
    )
    return paginated(
        [schemas.AttendanceRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/attendance/check-in",
    response_model=Envelope[schemas.AttendanceRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def check_in(
    payload: schemas.CheckInCreate, svc: Svc = Depends(domestic_staff_service)
) -> dict:
    return ok(
        schemas.AttendanceRead.model_validate(await svc.check_in(payload)), message="Checked in"
    )


@router.patch(
    "/attendance/{attendance_id}/check-out",
    response_model=Envelope[schemas.AttendanceRead],
    dependencies=[UPDATE],
)
async def check_out(attendance_id: uuid.UUID, svc: Svc = Depends(domestic_staff_service)) -> dict:
    return ok(
        schemas.AttendanceRead.model_validate(await svc.check_out(attendance_id)),
        message="Checked out",
    )


# --- ratings ---------------------------------------------------- #
@router.post(
    "/ratings",
    response_model=Envelope[schemas.RatingRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[VIEW],
)
async def rate_staff(
    payload: schemas.RatingCreate, svc: Svc = Depends(domestic_staff_service)
) -> dict:
    return ok(schemas.RatingRead.model_validate(await svc.rate_staff(payload)), message="Rated")


@router.get(
    "/{staff_id}/ratings",
    response_model=Envelope[list[schemas.RatingRead]],
    dependencies=[VIEW],
)
async def list_ratings(
    staff_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(domestic_staff_service),
) -> dict:
    rows, total = await svc.list_ratings(staff_id, offset=params.offset, limit=params.page_size)
    return paginated(
        [schemas.RatingRead.model_validate(r) for r in rows], total=total, params=params
    )


# --- staff directory ------------------------------------------ #
@router.get("", response_model=Envelope[list[schemas.StaffRead]], dependencies=[VIEW])
async def list_staff(
    community_id: uuid.UUID | None = None,
    q: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(domestic_staff_service),
) -> dict:
    rows, total = await svc.list_staff(
        community_id=community_id, q=q, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.StaffRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.StaffRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_staff(
    payload: schemas.StaffCreate,
    community_id: uuid.UUID | None = None,
    svc: Svc = Depends(domestic_staff_service),
) -> dict:
    return ok(
        schemas.StaffRead.model_validate(
            await svc.create_staff(payload, community_id=community_id)
        ),
        message="Staff created",
    )


@router.get("/{staff_id}", response_model=Envelope[schemas.StaffRead], dependencies=[VIEW])
async def get_staff(staff_id: uuid.UUID, svc: Svc = Depends(domestic_staff_service)) -> dict:
    return ok(schemas.StaffRead.model_validate(await svc.get_staff(staff_id)))


@router.patch("/{staff_id}", response_model=Envelope[schemas.StaffRead], dependencies=[UPDATE])
async def update_staff(
    staff_id: uuid.UUID,
    payload: schemas.StaffUpdate,
    svc: Svc = Depends(domestic_staff_service),
) -> dict:
    return ok(
        schemas.StaffRead.model_validate(await svc.update_staff(staff_id, payload)),
        message="Updated",
    )

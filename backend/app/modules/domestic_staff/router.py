"""Domestic Staff API (FR-06). HTTP boundary only — see service.py.

Canonical envelope. RBAC: `domestic_staff:{view,create,update,approve}`.
Contract: docs/backend/api/domestic-staff.md.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.domestic_staff import schemas
from app.modules.domestic_staff.deps import domestic_staff_service
from app.modules.domestic_staff.service import DomesticStaffService

router = APIRouter(prefix="/domestic-staff", tags=["Domestic Staff"])

VIEW = Depends(require_permission_async("domestic_staff:view"))
CREATE = Depends(require_permission_async("domestic_staff:create"))
UPDATE = Depends(require_permission_async("domestic_staff:update"))
DELETE = Depends(require_permission_async("domestic_staff:delete"))
APPROVE = Depends(require_permission_async("domestic_staff:approve"))

Svc = DomesticStaffService


@router.get("/health", summary="Domestic Staff module liveness")
async def module_health() -> dict:
    return ok({"module": "domestic_staff", "status": "ok"})


# --- self-service (staff persona) ------------------------------------- #
@router.get("/me", response_model=Envelope[schemas.StaffMeRead])
async def get_my_profile(svc: Svc = Depends(domestic_staff_service)) -> dict:
    return ok(await svc.get_my_profile())


@router.patch("/me", response_model=Envelope[schemas.StaffMeRead])
async def update_my_profile(
    payload: schemas.StaffMeUpdate, svc: Svc = Depends(domestic_staff_service)
) -> dict:
    return ok(await svc.update_my_profile(payload), message="Profile updated")


@router.get(
    "/me/assignments",
    response_model=Envelope[list[schemas.AssignmentDetailRead]],
)
async def get_my_assignments(
    params: PageParams = Depends(page_params), svc: Svc = Depends(domestic_staff_service)
) -> dict:
    rows, total = await svc.get_my_assignments(offset=params.offset, limit=params.page_size)
    return paginated(rows, total=total, params=params)


@router.get(
    "/me/attendance",
    response_model=Envelope[list[schemas.AttendanceRead]],
)
async def get_my_attendance(
    params: PageParams = Depends(page_params), svc: Svc = Depends(domestic_staff_service)
) -> dict:
    rows, total = await svc.get_my_attendance(offset=params.offset, limit=params.page_size)
    return paginated(
        [schemas.AttendanceRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get(
    "/me/visits",
    response_model=Envelope[list[schemas.StaffVisitRead]],
)
async def get_my_visits(
    params: PageParams = Depends(page_params), svc: Svc = Depends(domestic_staff_service)
) -> dict:
    rows, total = await svc.get_my_visits(offset=params.offset, limit=params.page_size)
    return paginated(rows, total=total, params=params)


@router.get(
    "/me/pass",
    response_model=Envelope[schemas.StaffPassRead],
)
async def get_my_pass(svc: Svc = Depends(domestic_staff_service)) -> dict:
    return ok(await svc.generate_my_pass())


@router.get(
    "/me/ratings",
    response_model=Envelope[list[schemas.RatingRead]],
)
async def get_my_ratings(
    params: PageParams = Depends(page_params), svc: Svc = Depends(domestic_staff_service)
) -> dict:
    rows, total = await svc.get_my_ratings(offset=params.offset, limit=params.page_size)
    return paginated(
        [schemas.RatingRead.model_validate(r) for r in rows], total=total, params=params
    )


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
    dependencies=[CREATE],
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


def _to_attendance_read(r: Any) -> schemas.AttendanceRead:
    read = schemas.AttendanceRead.model_validate(r)
    now = datetime.now(UTC)
    check_in = r.check_in_at
    if check_in.tzinfo is None:
        check_in = check_in.replace(tzinfo=UTC)
    if r.check_out_at is None:
        elapsed_sec = max(0.0, (now - check_in).total_seconds())
        read.duration_hours = round(elapsed_sec / 3600.0, 2)
        read.is_overdue = elapsed_sec > 12.0 * 3600.0
    else:
        check_out = r.check_out_at
        if check_out.tzinfo is None:
            check_out = check_out.replace(tzinfo=UTC)
        elapsed_sec = max(0.0, (check_out - check_in).total_seconds())
        read.duration_hours = round(elapsed_sec / 3600.0, 2)
        read.is_overdue = False
    return read


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
        [_to_attendance_read(r) for r in rows], total=total, params=params
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
        _to_attendance_read(await svc.check_in(payload)), message="Checked in"
    )


@router.patch(
    "/attendance/{attendance_id}/check-out",
    response_model=Envelope[schemas.AttendanceRead],
    dependencies=[UPDATE],
)
async def check_out(attendance_id: uuid.UUID, svc: Svc = Depends(domestic_staff_service)) -> dict:
    return ok(
        _to_attendance_read(await svc.check_out(attendance_id)),
        message="Checked out",
    )


@router.post(
    "/passes/verify",
    response_model=Envelope[schemas.StaffPassVerifyOut],
    dependencies=[CREATE],
)
async def verify_pass(
    payload: schemas.StaffPassVerifyIn, svc: Svc = Depends(domestic_staff_service)
) -> dict:
    return ok(await svc.verify_pass(payload))


# --- ratings ---------------------------------------------------- #
@router.post(
    "/ratings",
    response_model=Envelope[schemas.RatingRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
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


@router.delete(
    "/{staff_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_staff(
    staff_id: uuid.UUID, svc: Svc = Depends(domestic_staff_service)
) -> Response:
    await svc.delete_staff(staff_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

"""Residents API (FR-03). HTTP boundary only — see service.py for the rules.

Canonical envelope. RBAC: `residents:{view,create,update,delete}`.
Contract: docs/backend/api/residents.md.

Route order: static-prefix paths are declared before the `/{profile_id}` catch-all so
`GET /residents/move-records` isn't parsed as a profile id.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError
from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.security import require_auth_async
from app.core.tenancy import TenantScope, get_tenant_scope_async, require_permission_async
from app.db.session import get_async_db
from app.modules.residents import schemas
from app.modules.residents.deps import resident_service
from app.modules.residents.service import ResidentService
from app.modules.users.models import Role, User, UserRole

router = APIRouter(prefix="/residents", tags=["Residents"])

VIEW = Depends(require_permission_async("residents:view"))
CREATE = Depends(require_permission_async("residents:create"))
UPDATE = Depends(require_permission_async("residents:update"))
DELETE = Depends(require_permission_async("residents:delete"))


async def require_household_view(
    scope: TenantScope = Depends(get_tenant_scope_async),
    user: User = Depends(require_auth_async),
) -> TenantScope:
    if scope.can("residents:view"):
        return scope
    return scope


async def require_household_write(
    scope: TenantScope = Depends(get_tenant_scope_async),
    user: User = Depends(require_auth_async),
    db: AsyncSession = Depends(get_async_db, scope="function"),
) -> TenantScope:
    if (
        scope.can("residents:create")
        or scope.can("residents:update")
        or scope.can("residents:delete")
    ):
        return scope
    if not user.is_superadmin:
        roles = list(
            (
                await db.scalars(
                    select(Role.slug)
                    .join(UserRole, UserRole.role_id == Role.id)
                    .where(UserRole.user_id == user.id)
                )
            ).all()
        )
        if "resident" not in roles:
            raise ForbiddenError(
                "Only residents and community staff can manage household records",
                code="PERMISSION_DENIED",
            )
        if "auditor" in roles and not any(
            r in ("resident", "community_admin", "facility_manager") for r in roles
        ):
            raise ForbiddenError("Auditors are strictly read-only", code="AUDITOR_READ_ONLY")
    return scope


HOUSEHOLD_VIEW = Depends(require_household_view)
HOUSEHOLD_WRITE = Depends(require_household_write)


@router.get("/health", summary="Residents module liveness")
async def module_health() -> dict:
    return ok({"module": "residents", "status": "ok"})


# --- resident profiles: collection --------------------------------------- #
@router.get("", response_model=Envelope[list[schemas.ResidentProfileRead]], dependencies=[VIEW])
async def list_profiles(
    community_id: uuid.UUID | None = None,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = await svc.list_profiles(
        community_id=community_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.ResidentProfileRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "",
    response_model=Envelope[schemas.ResidentProfileRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_profile(
    payload: schemas.ResidentProfileCreate,
    community_id: uuid.UUID | None = None,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    obj = await svc.create_profile(payload, community_id=community_id)
    return ok(schemas.ResidentProfileRead.model_validate(obj), message="Resident profile created")


# --- occupancies (static prefixes first) ------------------------------ #
@router.get(
    "/units/{unit_id}/occupancies",
    response_model=Envelope[list[schemas.OccupancyRead]],
    dependencies=[VIEW],
)
async def list_occupancies(
    unit_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = await svc.list_occupancies(
        unit_id=unit_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.OccupancyRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get(
    "/units/{unit_id}/family-members",
    response_model=Envelope[list[schemas.FamilyMemberRead]],
    dependencies=[HOUSEHOLD_VIEW],
)
async def list_family(
    unit_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = await svc.list_family(
        unit_id=unit_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.FamilyMemberRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/occupancies",
    response_model=Envelope[schemas.OccupancyRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_occupancy(
    payload: schemas.OccupancyCreate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(
        schemas.OccupancyRead.model_validate(await svc.create_occupancy(payload)),
        message="Occupancy created",
    )


@router.patch(
    "/occupancies/{occupancy_id}/end",
    response_model=Envelope[schemas.OccupancyRead],
    dependencies=[UPDATE],
)
async def end_occupancy(
    occupancy_id: uuid.UUID,
    payload: schemas.OccupancyEnd,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.OccupancyRead.model_validate(await svc.end_occupancy(occupancy_id, payload)),
        message="Occupancy ended",
    )


# --- family members ------------------------------------------------ #
@router.post(
    "/family-members",
    response_model=Envelope[schemas.FamilyMemberRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[HOUSEHOLD_WRITE],
)
async def create_family(
    payload: schemas.FamilyMemberCreate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(
        schemas.FamilyMemberRead.model_validate(await svc.create_family(payload)),
        message="Family member added",
    )


@router.patch(
    "/family-members/{member_id}",
    response_model=Envelope[schemas.FamilyMemberRead],
    dependencies=[HOUSEHOLD_WRITE],
)
async def update_family(
    member_id: uuid.UUID,
    payload: schemas.FamilyMemberUpdate,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.FamilyMemberRead.model_validate(await svc.update_family(member_id, payload)),
        message="Family member updated",
    )


@router.delete(
    "/family-members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[HOUSEHOLD_WRITE],
)
async def delete_family(
    member_id: uuid.UUID, svc: ResidentService = Depends(resident_service)
) -> Response:
    await svc.delete_family(member_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/family-members/{member_id}/pass",
    response_model=Envelope[schemas.FamilyPassRead],
    dependencies=[HOUSEHOLD_VIEW],
)
async def get_family_pass(
    member_id: uuid.UUID, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(await svc.get_family_pass(member_id))


@router.post(
    "/family-members/verify-pass",
    response_model=Envelope[schemas.FamilyPassVerifyOut],
)
async def verify_family_pass(
    payload: schemas.FamilyPassVerifyIn, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(await svc.verify_family_pass(payload))


# --- emergency contacts (delete-by-id) --------------------------------- #
@router.delete(
    "/emergency-contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[HOUSEHOLD_WRITE],
)
async def delete_contact(
    contact_id: uuid.UUID, svc: ResidentService = Depends(resident_service)
) -> Response:
    await svc.delete_contact(contact_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- move records ------------------------------------------------- #
@router.get(
    "/move-records", response_model=Envelope[list[schemas.MoveRecordRead]], dependencies=[VIEW]
)
async def list_moves(
    community_id: uuid.UUID | None = None,
    move_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = await svc.list_moves(
        community_id=community_id, status=move_status, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.MoveRecordRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.get("/moves", response_model=Envelope[list[schemas.MoveRecordRead]], dependencies=[VIEW])
async def list_moves_alias(
    community_id: uuid.UUID | None = None,
    move_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = await svc.list_moves(
        community_id=community_id, status=move_status, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.MoveRecordRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/move-records",
    response_model=Envelope[schemas.MoveRecordRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_move(
    payload: schemas.MoveRecordCreate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(
        schemas.MoveRecordRead.model_validate(await svc.create_move(payload)),
        message="Move record created",
    )


@router.get(
    "/move-records/{move_id}", response_model=Envelope[schemas.MoveRecordRead], dependencies=[VIEW]
)
async def get_move(move_id: uuid.UUID, svc: ResidentService = Depends(resident_service)) -> dict:
    return ok(schemas.MoveRecordRead.model_validate(await svc.get_move(move_id)))


@router.patch(
    "/move-records/{move_id}/status",
    response_model=Envelope[schemas.MoveRecordRead],
    dependencies=[UPDATE],
)
async def transition_move(
    move_id: uuid.UUID,
    payload: schemas.MoveRecordTransition,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.MoveRecordRead.model_validate(await svc.transition_move(move_id, payload)),
        message="Updated",
    )


@router.patch(
    "/moves/{move_id}",
    response_model=Envelope[schemas.MoveRecordRead],
    dependencies=[UPDATE],
)
async def transition_move_alias(
    move_id: uuid.UUID,
    payload: schemas.MoveRecordTransition,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.MoveRecordRead.model_validate(await svc.transition_move(move_id, payload)),
        message="Updated",
    )


# --- resident me / self-service (declared before /{profile_id}) ------- #
@router.get("/me", response_model=Envelope[schemas.ResidentMeRead])
async def get_my_profile(svc: ResidentService = Depends(resident_service)) -> dict:
    return ok(await svc.get_my_profile())


@router.patch("/me", response_model=Envelope[schemas.ResidentMeRead])
async def update_my_profile(
    payload: schemas.ResidentMeUpdate, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(await svc.update_my_profile(payload), message="Profile updated")


# --- resident profile by id (catch-all — declared last) --------------- #
@router.get(
    "/{profile_id}", response_model=Envelope[schemas.ResidentProfileRead], dependencies=[VIEW]
)
async def get_profile(
    profile_id: uuid.UUID, svc: ResidentService = Depends(resident_service)
) -> dict:
    return ok(schemas.ResidentProfileRead.model_validate(await svc.get_profile(profile_id)))


@router.patch(
    "/{profile_id}", response_model=Envelope[schemas.ResidentProfileRead], dependencies=[UPDATE]
)
async def update_profile(
    profile_id: uuid.UUID,
    payload: schemas.ResidentProfileUpdate,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.ResidentProfileRead.model_validate(await svc.update_profile(profile_id, payload)),
        message="Updated",
    )


@router.delete(
    "/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[DELETE],
)
async def delete_profile(
    profile_id: uuid.UUID, svc: ResidentService = Depends(resident_service)
) -> Response:
    await svc.delete_profile(profile_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{profile_id}/emergency-contacts",
    response_model=Envelope[list[schemas.EmergencyContactRead]],
    dependencies=[HOUSEHOLD_VIEW],
)
async def list_contacts(
    profile_id: uuid.UUID,
    params: PageParams = Depends(page_params),
    svc: ResidentService = Depends(resident_service),
) -> dict:
    rows, total = await svc.list_contacts(
        profile_id=profile_id, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.EmergencyContactRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/{profile_id}/emergency-contacts",
    response_model=Envelope[schemas.EmergencyContactRead],
    status_code=status.HTTP_201_CREATED,
    dependencies=[HOUSEHOLD_WRITE],
)
async def create_contact(
    profile_id: uuid.UUID,
    payload: schemas.EmergencyContactCreate,
    svc: ResidentService = Depends(resident_service),
) -> dict:
    return ok(
        schemas.EmergencyContactRead.model_validate(await svc.create_contact(profile_id, payload)),
        message="Contact added",
    )

"""Tenant onboarding API (FR-03): URL invitations + direct add / remove of tenants.

HTTP boundary only — rules live in service.py. Canonical envelope.

RBAC (community-scoped): `residents:create` to invite / add, `residents:view` to list,
`residents:delete` to remove. The two token endpoints (`GET /invitations/{token}`,
`POST /invitations/{token}/accept`) are **public** — an invitee may not have an account yet.
Contract: docs/backend/api/onboarding.md.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status

from app.core.responses import PageParams, ok, page_params, paginated
from app.core.responses import Response as Envelope
from app.core.tenancy import require_permission_async
from app.modules.onboarding import schemas
from app.modules.onboarding.deps import (
    onboarding_service,
    optional_user,
    public_onboarding_service,
)
from app.modules.onboarding.service import OnboardingService
from app.modules.users.models import User

router = APIRouter(tags=["Onboarding"])

CREATE = Depends(require_permission_async("residents:create"))
VIEW = Depends(require_permission_async("residents:view"))
DELETE = Depends(require_permission_async("residents:delete"))

Svc = OnboardingService


@router.get("/onboarding/health", summary="Onboarding module liveness")
async def module_health() -> dict:
    return ok({"module": "onboarding", "status": "ok"})


# --- invitations: owner / admin ------------------------------------------ #
@router.post(
    "/communities/{community_id}/invitations",
    response_model=Envelope[schemas.InvitationCreated],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def create_invitation(
    community_id: uuid.UUID,
    payload: schemas.InvitationCreate,
    svc: Svc = Depends(onboarding_service),
) -> dict:
    return ok(
        await svc.create_invitation(community_id, payload),
        message="Invitation created",
    )


@router.get(
    "/communities/{community_id}/invitations",
    response_model=Envelope[list[schemas.InvitationRead]],
    dependencies=[VIEW],
)
async def list_invitations(
    community_id: uuid.UUID,
    invite_status: str | None = None,
    params: PageParams = Depends(page_params),
    svc: Svc = Depends(onboarding_service),
) -> dict:
    rows, total = await svc.list_invitations(
        community_id, status=invite_status, offset=params.offset, limit=params.page_size
    )
    return paginated(
        [schemas.InvitationRead.model_validate(r) for r in rows], total=total, params=params
    )


@router.post(
    "/communities/{community_id}/invitations/{invitation_id}/revoke",
    response_model=Envelope[schemas.InvitationRead],
    dependencies=[CREATE],
)
async def revoke_invitation(
    community_id: uuid.UUID,
    invitation_id: uuid.UUID,
    svc: Svc = Depends(onboarding_service),
) -> dict:
    return ok(
        schemas.InvitationRead.model_validate(
            await svc.revoke_invitation(community_id, invitation_id)
        ),
        message="Invitation revoked",
    )


# --- invitations: public (token) --------------------------------------- #
@router.get("/invitations/{token}", response_model=Envelope[schemas.InvitationPublic])
async def view_invitation(token: str, svc: Svc = Depends(public_onboarding_service)) -> dict:
    return ok(await svc.public_view(token))


@router.post("/invitations/{token}/accept", response_model=Envelope[schemas.TenantOut])
async def accept_invitation(
    token: str,
    payload: schemas.InvitationAccept,
    response: Response,
    svc: Svc = Depends(public_onboarding_service),
    current: User | None = Depends(optional_user),
) -> dict:
    return ok(
        await svc.accept(token, payload, current_user=current, response=response),
        message="Invitation accepted",
    )


# --- direct tenant management ----------------------------------------- #
@router.post(
    "/communities/{community_id}/tenants",
    response_model=Envelope[schemas.TenantOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[CREATE],
)
async def add_tenant(
    community_id: uuid.UUID,
    payload: schemas.TenantAdd,
    svc: Svc = Depends(onboarding_service),
) -> dict:
    return ok(await svc.add_tenant(community_id, payload), message="Tenant added")


@router.delete(
    "/communities/{community_id}/tenants/{profile_id}",
    response_model=Envelope[schemas.TenantOut],
    dependencies=[DELETE],
)
async def remove_tenant(
    community_id: uuid.UUID,
    profile_id: uuid.UUID,
    svc: Svc = Depends(onboarding_service),
) -> dict:
    return ok(await svc.remove_tenant(community_id, profile_id), message="Tenant removed")


@router.delete(
    "/communities/{community_id}/units/{unit_id}/occupants/{occupancy_id}",
    response_model=Envelope[schemas.OccupancyOut],
    dependencies=[DELETE],
)
async def remove_occupant(
    community_id: uuid.UUID,
    unit_id: uuid.UUID,
    occupancy_id: uuid.UUID,
    svc: Svc = Depends(onboarding_service),
) -> dict:
    return ok(
        await svc.remove_occupancy(community_id, unit_id, occupancy_id),
        message="Occupant removed from unit",
    )

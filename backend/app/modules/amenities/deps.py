"""Dependency wiring for the Amenities router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.amenities.service import AmenityService
from app.modules.users.models import User


def amenity_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> AmenityService:
    return AmenityService(ctx.db, ctx.scope, user, request)

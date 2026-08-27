"""Dependency wiring for the Vehicles router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.users.models import User
from app.modules.vehicles.service import VehicleService


def vehicle_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> VehicleService:
    return VehicleService(ctx.db, ctx.scope, user, request)

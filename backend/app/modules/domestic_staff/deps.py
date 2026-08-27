"""Dependency wiring for the Domestic Staff router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.domestic_staff.service import DomesticStaffService
from app.modules.users.models import User


def domestic_staff_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> DomesticStaffService:
    return DomesticStaffService(ctx.db, ctx.scope, user, request)

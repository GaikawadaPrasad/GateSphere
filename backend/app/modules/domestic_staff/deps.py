"""Dependency wiring for the Domestic Staff router (async — ADR-010)."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.context import RequestContext
from app.core.security import require_auth_async
from app.core.tenancy import AsyncTenantContext, async_tenant_context
from app.modules.domestic_staff.service import DomesticStaffService
from app.modules.users.models import User


def domestic_staff_service(
    request: Request,
    ctx: AsyncTenantContext = Depends(async_tenant_context),
    user: User = Depends(require_auth_async),
) -> DomesticStaffService:
    return DomesticStaffService(ctx.db, ctx.scope, user, RequestContext.from_request(request))

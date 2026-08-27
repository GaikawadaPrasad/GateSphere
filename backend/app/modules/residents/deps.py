"""Dependency wiring for the Residents router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.residents.service import ResidentService
from app.modules.users.models import User


def resident_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> ResidentService:
    return ResidentService(ctx.db, ctx.scope, user, request)

"""Dependency wiring for the Dashboards router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.dashboards.service import DashboardService
from app.modules.users.models import User


def dashboard_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> DashboardService:
    return DashboardService(ctx.db, ctx.scope, user, request)

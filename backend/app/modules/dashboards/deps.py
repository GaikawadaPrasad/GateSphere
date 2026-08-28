"""Dependency wiring for the Dashboards router (async — ADR-010)."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth_async
from app.core.tenancy import AsyncTenantContext, async_tenant_context
from app.modules.dashboards.service import DashboardService
from app.modules.users.models import User


def dashboard_service(
    request: Request,
    ctx: AsyncTenantContext = Depends(async_tenant_context),
    user: User = Depends(require_auth_async),
) -> DashboardService:
    return DashboardService(ctx.db, ctx.scope, user, request)

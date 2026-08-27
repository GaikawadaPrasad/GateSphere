"""Dependency wiring for the Billing router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.billing.service import BillingService
from app.modules.users.models import User


def billing_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> BillingService:
    return BillingService(ctx.db, ctx.scope, user, request)

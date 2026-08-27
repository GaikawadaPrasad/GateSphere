"""Dependency wiring for the Deliveries router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.deliveries.service import DeliveryService
from app.modules.users.models import User


def delivery_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> DeliveryService:
    return DeliveryService(ctx.db, ctx.scope, user, request)

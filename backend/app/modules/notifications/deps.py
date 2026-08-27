"""Dependency wiring for the Notifications router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User


def notification_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> NotificationService:
    return NotificationService(ctx.db, ctx.scope, user, request)

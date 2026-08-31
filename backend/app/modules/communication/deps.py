"""Dependency wiring for the Communication router (async — ADR-010)."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.context import RequestContext
from app.core.security import require_auth_async
from app.core.tenancy import AsyncTenantContext, async_tenant_context
from app.modules.communication.service import CommunicationService
from app.modules.users.models import User


def communication_service(
    request: Request,
    ctx: AsyncTenantContext = Depends(async_tenant_context),
    user: User = Depends(require_auth_async),
) -> CommunicationService:
    return CommunicationService(ctx.db, ctx.scope, user, RequestContext.from_request(request))

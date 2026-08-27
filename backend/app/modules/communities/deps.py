"""Dependency wiring for the Community & Property router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.communities.service import CommunityService
from app.modules.users.models import User


def community_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> CommunityService:
    return CommunityService(ctx.db, ctx.scope, user, request)

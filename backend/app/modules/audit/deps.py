"""Dependency wiring for the Audit query router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.audit.query_service import AuditQueryService
from app.modules.users.models import User


def audit_query_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> AuditQueryService:
    return AuditQueryService(ctx.db, ctx.scope, user, request)

"""Dependency wiring for the Complaints router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.complaints.service import ComplaintService
from app.modules.users.models import User


def complaint_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> ComplaintService:
    return ComplaintService(ctx.db, ctx.scope, user, request)

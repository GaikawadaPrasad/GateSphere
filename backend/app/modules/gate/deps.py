"""Dependency wiring for the Gate Operations router."""

from __future__ import annotations

from fastapi import Depends, Request

from app.core.security import require_auth
from app.core.tenancy import TenantContext, tenant_context
from app.modules.gate.service import GateService
from app.modules.users.models import User


def gate_service(
    request: Request,
    ctx: TenantContext = Depends(tenant_context),
    user: User = Depends(require_auth),
) -> GateService:
    return GateService(ctx.db, ctx.scope, user, request)

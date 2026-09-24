"""Dependency wiring for the onboarding router (async — ADR-010).

`onboarding_service` — community-scoped, for the authenticated admin/owner endpoints.
`public_onboarding_service` + `optional_user` — for the token endpoints, which must work
for a signed-out invitee (new account) and a signed-in one alike.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    _load_session_async,
    require_auth_async,
    verify_csrf,
)
from app.core.tenancy import AsyncTenantContext, async_tenant_context
from app.db.session import get_async_db
from app.modules.onboarding.service import OnboardingService
from app.modules.users.models import User


def onboarding_service(
    request: Request,
    ctx: AsyncTenantContext = Depends(async_tenant_context),
    user: User = Depends(require_auth_async),
) -> OnboardingService:
    return OnboardingService(ctx.db, ctx.scope, user, request)


def public_onboarding_service(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
) -> OnboardingService:
    return OnboardingService(db, None, None, request)


async def optional_user(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
) -> User | None:
    """The signed-in user, or ``None`` — never raises. Used by ``POST .../accept``."""
    if not request.cookies.get(settings.SESSION_COOKIE_NAME):
        return None
    try:
        verify_csrf(request)
        session = await _load_session_async(db, request)
        user = await db.get(User, uuid.UUID(session["user_id"]))
    except AppError:
        return None
    return user if user and user.is_active else None

"""Authentication endpoints: login / logout / me.

HTTP boundary only. Credential checks and the session lifecycle live in app.core.security.
Responses use the canonical envelope (AGENTS.md §6): {success, message, data, meta}.
"""

from fastapi import APIRouter, Depends, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthError
from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import (
    create_session,
    destroy_session,
    hash_password,
    needs_rehash,
    require_auth_async,
    user_permissions_async,
    verify_password,
)
from app.db.session import AsyncSessionLocal, get_async_db
from app.modules.audit.service import record_audit_async
from app.modules.auth.schemas import CurrentUser, LoginRequest
from app.modules.users.models import User, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=Envelope[CurrentUser])
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_async_db),
) -> dict:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        # Failed logins are audited (FR-01, TRD §5.2). The request session is rolled back
        # when the AuthError propagates, so write the record in its own transaction.
        async with AsyncSessionLocal() as audit_db:
            await record_audit_async(
                audit_db,
                module="auth",
                action="login.failed",
                actor=user if user else None,
                entity_type="user",
                entity_id=str(user.id) if user else None,
                new={"email": payload.email.lower(), "reason": "invalid_credentials"},
                request=request,
            )
            await audit_db.commit()
        # Uniform error — never reveal which check failed.
        raise AuthError("Invalid email or password", code="INVALID_CREDENTIALS")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    await create_session(db, response, user, request)
    await record_audit_async(
        db,
        module="auth",
        action="login.success",
        actor=user,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    return ok(await _serialize(db, user), message="Signed in")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(require_auth_async),
) -> Response:
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    await destroy_session(db, request, resp)
    await record_audit_async(
        db,
        module="auth",
        action="logout",
        actor=user,
        entity_type="user",
        entity_id=str(user.id),
        request=request,
    )
    return resp


@router.get("/me", response_model=Envelope[CurrentUser])
async def me(
    db: AsyncSession = Depends(get_async_db), user: User = Depends(require_auth_async)
) -> dict:
    return ok(await _serialize(db, user))


async def _serialize(db: AsyncSession, user: User) -> CurrentUser:
    community_ids = (
        await db.scalars(select(UserRole.community_id).where(UserRole.user_id == user.id))
    ).all()
    return CurrentUser(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        is_superadmin=user.is_superadmin,
        permissions=sorted(await user_permissions_async(db, user)),
        community_ids=sorted({str(c) for c in community_ids if c is not None}),
        permission_version=user.permission_version or 0,
    )

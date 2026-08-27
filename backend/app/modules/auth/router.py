"""Authentication endpoints: login / logout / me.

HTTP boundary only. Credential checks and the session lifecycle live in app.core.security.
Responses use the canonical envelope (AGENTS.md §6): {success, message, data, meta}.
"""

from fastapi import APIRouter, Depends, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AuthError
from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import (
    create_session,
    destroy_session,
    hash_password,
    needs_rehash,
    require_auth,
    user_permissions,
    verify_password,
)
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser, LoginRequest
from app.modules.users.models import User, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=Envelope[CurrentUser])
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> dict:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        # Uniform error — never reveal which check failed.
        raise AuthError("Invalid email or password", code="INVALID_CREDENTIALS")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    create_session(db, response, user, request)
    return ok(_serialize(db, user), message="Signed in")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(require_auth),
) -> Response:
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    destroy_session(db, request, resp)
    return resp


@router.get("/me", response_model=Envelope[CurrentUser])
def me(db: Session = Depends(get_db), user: User = Depends(require_auth)) -> dict:
    return ok(_serialize(db, user))


def _serialize(db: Session, user: User) -> CurrentUser:
    community_ids = db.scalars(
        select(UserRole.community_id).where(UserRole.user_id == user.id)
    ).all()
    return CurrentUser(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        is_superadmin=user.is_superadmin,
        permissions=sorted(user_permissions(db, user)),
        community_ids=sorted({str(c) for c in community_ids if c is not None}),
    )

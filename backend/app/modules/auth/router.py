"""Authentication endpoints: login / logout / me.

HTTP boundary only. Credential checks and session creation live in app.core.security.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    _user_permissions,
    create_session,
    destroy_session,
    require_auth,
    verify_password,
)
from app.db.session import get_db
from app.modules.auth.schemas import CurrentUser, LoginRequest
from app.modules.users.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=CurrentUser)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> CurrentUser:
    user = db.query(User).filter(User.email == payload.email.lower()).one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        # Uniform error — never reveal which check failed.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    create_session(response, user.id)
    return _serialize(db, user)


@router.post("/logout")
def logout(request: Request, _: User = Depends(require_auth)) -> Response:
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    destroy_session(request, resp)
    return resp


@router.get("/me", response_model=CurrentUser)
def me(db: Session = Depends(get_db), user: User = Depends(require_auth)) -> CurrentUser:
    return _serialize(db, user)


def _serialize(db: Session, user: User) -> CurrentUser:
    return CurrentUser(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        is_superadmin=user.is_superadmin,
        permissions=sorted(_user_permissions(db, user)),
    )

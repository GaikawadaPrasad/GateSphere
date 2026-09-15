"""Authentication endpoints: login / logout / me.

HTTP boundary only — validate the request, call one `AuthService` method, serialize.
Credential checks, the session lifecycle and audit live in `app.modules.auth.service` /
`app.core.security`. Responses use the canonical envelope (AGENTS.md §6).
Login rate limiting is the `auth` path class in `app/core/ratelimit.py`.
"""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import require_auth_async
from app.db.session import get_async_db
from app.modules.auth.schemas import CurrentUser, LoginRequest, PasswordChangeRequest
from app.modules.auth.service import AuthService
from app.modules.users.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


def auth_service(db: AsyncSession = Depends(get_async_db)) -> AuthService:
    return AuthService(db)


@router.post("/login", response_model=Envelope[CurrentUser])
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    svc: AuthService = Depends(auth_service),
) -> dict:
    current = await svc.login(
        request, response, email=payload.email, password=payload.password, role=payload.role
    )
    return ok(current, message="Signed in")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(
    request: Request,
    svc: AuthService = Depends(auth_service),
    user: User = Depends(require_auth_async),
) -> Response:
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    await svc.logout(request, resp, user)
    return resp


@router.get("/me", response_model=Envelope[CurrentUser])
async def me(
    request: Request,
    svc: AuthService = Depends(auth_service),
    user: User = Depends(require_auth_async),
) -> dict:
    return ok(await svc.me(request, user))


@router.post("/password", response_model=Envelope[dict])
async def change_password(
    request: Request,
    response: Response,
    payload: PasswordChangeRequest,
    svc: AuthService = Depends(auth_service),
    user: User = Depends(require_auth_async),
) -> dict:
    await svc.change_password(
        request,
        response,
        user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return ok({"status": "password_changed"}, message="Password changed successfully")

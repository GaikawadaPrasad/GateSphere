"""Session-cookie authentication, CSRF, password hashing and RBAC dependencies.

Auth model (see docs/platform/authentication.md):
  * Login verifies credentials, creates a Redis-backed session, sets two cookies:
      - gs_session : opaque token, HttpOnly, SameSite=Lax  -> identifies the session
      - gs_csrf    : random value, readable by JS           -> double-submit CSRF token
  * Every unsafe request (POST/PUT/PATCH/DELETE) must send header `X-CSRF-Token`
    matching the gs_csrf cookie.
  * Authorization is enforced server-side via require_permission(...).
"""

from __future__ import annotations

import json
import secrets
import uuid
from collections.abc import Callable

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import redis_client
from app.db.session import get_db
from app.modules.users.models import Permission, RolePermission, User, UserRole

_ph = PasswordHasher()

_SESSION_PREFIX = "session:"


def hash_password(raw: str) -> str:
    return _ph.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, raw)
    except VerifyMismatchError:
        return False


# --------------------------------------------------------------------------- #
# Session lifecycle
# --------------------------------------------------------------------------- #
def create_session(response: Response, user_id: uuid.UUID) -> None:
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    redis_client.setex(
        _SESSION_PREFIX + token,
        settings.SESSION_TTL_SECONDS,
        json.dumps({"user_id": str(user_id), "csrf": csrf}),
    )
    common = {
        "domain": settings.COOKIE_DOMAIN,
        "secure": settings.COOKIE_SECURE,
        "samesite": "lax",
        "max_age": settings.SESSION_TTL_SECONDS,
        "path": "/",
    }
    response.set_cookie(settings.SESSION_COOKIE_NAME, token, httponly=True, **common)
    response.set_cookie(settings.CSRF_COOKIE_NAME, csrf, httponly=False, **common)


def destroy_session(request: Request, response: Response) -> None:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if token:
        redis_client.delete(_SESSION_PREFIX + token)
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")


def _load_session(request: Request) -> dict:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    raw = redis_client.get(_SESSION_PREFIX + token)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    data = json.loads(raw)
    data["_token"] = token
    return data


def verify_csrf(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header = request.headers.get("X-CSRF-Token")
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF token missing or invalid")


# --------------------------------------------------------------------------- #
# Dependencies
# --------------------------------------------------------------------------- #
def require_auth(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(verify_csrf),
) -> User:
    session = _load_session(request)
    user = db.get(User, uuid.UUID(session["user_id"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive")
    request.state.session_id = session["_token"]
    return user


def _user_permissions(db: Session, user: User) -> set[str]:
    if user.is_superadmin:
        return {"*"}
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(UserRole.user_id == user.id)
        .all()
    )
    return {code for (code,) in rows}


def require_permission(code: str) -> Callable[..., User]:
    """Usage: `user = Depends(require_permission("visitors:approve"))`."""

    def dep(user: User = Depends(require_auth), db: Session = Depends(get_db)) -> User:
        perms = _user_permissions(db, user)
        if "*" in perms or code in perms:
            return user
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Missing permission: {code}")

    return dep

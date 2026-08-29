"""Session-cookie authentication, CSRF, password hashing and RBAC dependencies.

Auth model (docs/platform/authentication.md, AGENTS.md §7):
  * Login verifies credentials (Argon2) and creates a session:
      - a row in `user_sessions` (system of record: key hash, csrf, ip, ua, expiry)
      - a Redis cache entry (fast lookup; reconstructible from the DB row)
      - two cookies:
          gs_session : opaque token, HttpOnly, SameSite=Lax  -> identifies the session
          gs_csrf    : random value, JS-readable              -> double-submit CSRF token
  * Every unsafe request (POST/PUT/PATCH/DELETE) must send header `X-CSRF-Token`
    matching the gs_csrf cookie.
  * Sessions are revoked on logout, password change, and role change.
  * Authorization is enforced server-side via require_permission(...).
"""

from __future__ import annotations

import contextlib
import hashlib
import ipaddress
import json
import secrets
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, Request, Response
from redis.exceptions import RedisError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthError, ForbiddenError
from app.core.redis import redis_client
from app.db.session import get_async_db
from app.modules.auth.models import UserSession
from app.modules.users.models import (
    CommunityRolePermission,
    Permission,
    RolePermission,
    User,
    UserRole,
)

_ph = PasswordHasher()
_SESSION_PREFIX = "session:"


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #
def hash_password(raw: str) -> str:
    return _ph.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, raw)
    except VerifyMismatchError:
        return False


def needs_rehash(hashed: str) -> bool:
    return _ph.check_needs_rehash(hashed)


# --------------------------------------------------------------------------- #
# Session lifecycle
# --------------------------------------------------------------------------- #
def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# Cache is best-effort: a Redis outage degrades to a DB lookup, never an error (AGENTS.md §9.1).
def _cache_put(token_hash: str, payload: dict, ttl: int) -> None:
    with contextlib.suppress(RedisError):
        redis_client.setex(_SESSION_PREFIX + token_hash, ttl, json.dumps(payload))


def _cache_get(token_hash: str) -> dict | None:
    try:
        raw = redis_client.get(_SESSION_PREFIX + token_hash)
    except RedisError:
        return None
    return json.loads(raw) if raw else None


def _cache_drop(token_hash: str) -> None:
    with contextlib.suppress(RedisError):
        redis_client.delete(_SESSION_PREFIX + token_hash)


def _client_ip(request: Request) -> str | None:
    host = request.client.host if request.client else None
    if not host:
        return None
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        return None


async def create_session(
    db: AsyncSession, response: Response, user: User, request: Request
) -> UserSession:
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    token_hash = _hash_token(token)
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.SESSION_TTL_SECONDS)

    session = UserSession(
        user_id=user.id,
        session_key_hash=token_hash,
        csrf_token=csrf,
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        created_at=now,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()

    _cache_put(
        token_hash,
        {"session_id": str(session.id), "user_id": str(user.id), "csrf": csrf},
        settings.SESSION_TTL_SECONDS,
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
    return session


async def destroy_session(db: AsyncSession, request: Request, response: Response) -> None:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if token:
        token_hash = _hash_token(token)
        _cache_drop(token_hash)
        row = await db.scalar(select(UserSession).where(UserSession.session_key_hash == token_hash))
        if row and row.revoked_at is None:
            row.revoked_at = datetime.now(UTC)
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")


async def revoke_all_user_sessions_async(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Call on password change and role change (AGENTS.md §7)."""
    now = datetime.now(UTC)
    rows = (
        await db.scalars(
            select(UserSession).where(
                UserSession.user_id == user_id, UserSession.revoked_at.is_(None)
            )
        )
    ).all()
    for row in rows:
        row.revoked_at = now
        _cache_drop(row.session_key_hash)


async def invalidate_user_permissions_async(db: AsyncSession, user_ids: Iterable[uuid.UUID]) -> int:
    """Bump `permission_version` and revoke live sessions for the given users.

    Called after any change to a role's permission set (global or per-community) or a
    role grant/revoke, so affected users re-authenticate and pick up the new permissions.
    Returns the number of users touched.
    """
    ids = [uid for uid in dict.fromkeys(user_ids) if uid is not None]
    if not ids:
        return 0
    await db.execute(
        update(User).where(User.id.in_(ids)).values(permission_version=User.permission_version + 1)
    )
    for uid in ids:
        await revoke_all_user_sessions_async(db, uid)
    return len(ids)


async def users_with_role_async(
    db: AsyncSession, role_id: uuid.UUID, community_id: uuid.UUID | None = None
) -> list[uuid.UUID]:
    """User ids holding `role_id` — globally, or (when `community_id` is given) either in
    that community or via a platform-global grant."""
    stmt = select(UserRole.user_id).where(UserRole.role_id == role_id)
    if community_id is not None:
        stmt = stmt.where(
            (UserRole.community_id == community_id) | (UserRole.community_id.is_(None))
        )
    return list((await db.scalars(stmt)).all())


def verify_csrf(request: Request) -> None:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header = request.headers.get("X-CSRF-Token")
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise ForbiddenError("CSRF token missing or invalid", code="CSRF_INVALID")


# --------------------------------------------------------------------------- #
# Dependencies (async — ADR-010)
# --------------------------------------------------------------------------- #
async def _load_session_async(db: AsyncSession, request: Request) -> dict:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        raise AuthError("Not authenticated")
    token_hash = _hash_token(token)

    cached = _cache_get(token_hash)
    if cached:
        cached["_token_hash"] = token_hash
        return cached

    row = await db.scalar(select(UserSession).where(UserSession.session_key_hash == token_hash))
    if row is None:
        raise AuthError("Session not found")
    if row.revoked_at is not None:
        raise AuthError("Session revoked")
    if row.expires_at <= datetime.now(UTC):
        raise AuthError("Session expired")

    payload = {"session_id": str(row.id), "user_id": str(row.user_id), "csrf": row.csrf_token}
    ttl = int((row.expires_at - datetime.now(UTC)).total_seconds())
    _cache_put(token_hash, payload, max(ttl, 1))
    payload["_token_hash"] = token_hash
    return payload


async def require_auth_async(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    _: None = Depends(verify_csrf),
) -> User:
    session = await _load_session_async(db, request)
    user = await db.get(User, uuid.UUID(session["user_id"]))
    if not user or not user.is_active:
        raise AuthError("User inactive")
    request.state.session_id = session["session_id"]
    request.state.user = user
    return user


async def user_permissions_async(
    db: AsyncSession, user: User, community_id: uuid.UUID | None = None
) -> set[str]:
    """Effective permission codes for `user`.

    `community_id=None` → the coarse union across every role the user holds (the route-level
    gate). `community_id` given → only the roles that apply in that community (community-
    scoped grants for it + platform-global grants), with that community's
    `community_role_permissions` overrides applied:
        effective = role_defaults + {allow overrides} - {deny overrides}
    """
    if user.is_superadmin:
        return {"*"}

    grants = (
        await db.execute(
            select(UserRole.role_id, UserRole.community_id).where(UserRole.user_id == user.id)
        )
    ).all()
    if community_id is None:
        role_ids = {rid for (rid, _c) in grants}
    else:
        role_ids = {rid for (rid, c) in grants if c is None or c == community_id}
    if not role_ids:
        return set()

    perms: set[str] = set(
        (
            await db.scalars(
                select(Permission.code)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .where(RolePermission.role_id.in_(role_ids))
            )
        ).all()
    )
    if community_id is None:
        return perms

    overrides = (
        await db.execute(
            select(Permission.code, CommunityRolePermission.effect)
            .join(
                CommunityRolePermission,
                CommunityRolePermission.permission_id == Permission.id,
            )
            .where(
                CommunityRolePermission.community_id == community_id,
                CommunityRolePermission.role_id.in_(role_ids),
            )
        )
    ).all()
    for code, effect in overrides:
        perms.add(code) if effect == "allow" else perms.discard(code)
    return perms


async def require_platform_admin(user: User = Depends(require_auth_async)) -> User:
    """Only `super_admin` (`is_superadmin`) — the platform operator, not a community admin."""
    if not user.is_superadmin:
        raise ForbiddenError("Platform admin only", code="PLATFORM_ADMIN_ONLY")
    return user


# `require_permission_async` lives in `app.core.tenancy` (it needs the resolved TenantScope so
# per-community RBAC overrides are enforced), but is re-exported here for the ~20 routers that
# import it from `app.core.security`. Imported last to avoid a circular import at module load.
from app.core.tenancy import require_permission_async  # noqa: E402,F401

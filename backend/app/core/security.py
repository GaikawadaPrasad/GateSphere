"""Session-cookie authentication, CSRF, password hashing and RBAC dependencies.

Auth model (docs/backend/AUTHENTICATION.md, AGENTS.md §7):
  * Login verifies credentials (Argon2) and creates a session:
      - a row in `user_sessions` (system of record: key hash, csrf, role, community,
        ip, ua, created/expiry/last-activity/revoked)
      - a Redis cache entry (fast lookup; reconstructible from the DB row)
      - two cookies, namespaced by the session's ROLE BUCKET so several role sessions
        can coexist in one browser / cookie jar without one overwriting another:
          gatesphere_<bucket>_session : opaque token, HttpOnly, SameSite  -> the session
          gatesphere_<bucket>_csrf    : random value, JS-readable          -> CSRF token
        Legacy `gs_session` / `gs_csrf` are still accepted on READ (bucket "default").
  * When a request carries more than one session cookie, the caller selects which with
    the `X-Session-Role` header (role slug or bucket). One present -> used implicitly.
  * Every unsafe request (POST/PUT/PATCH/DELETE) must send header `X-CSRF-Token`
    matching the selected session's csrf cookie.
  * Logout revokes ONLY the presented session; password / role change revoke all of a
    user's sessions.
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

# Role -> cookie bucket. Roles that share a bucket cannot be held simultaneously in one
# jar, which is fine: the two security roles are one operator persona for testing.
# Any role not listed buckets to its own slug.
ROLE_COOKIE_BUCKETS: dict[str, str] = {
    "super_admin": "superadmin",
    "security_supervisor": "security",
    "security_guard": "security",
}
_LEGACY_BUCKET = "default"


def bucket_for_role(role_slug: str | None) -> str:
    if not role_slug:
        return _LEGACY_BUCKET
    return ROLE_COOKIE_BUCKETS.get(role_slug, role_slug)


def session_cookie_names(bucket: str) -> tuple[str, str]:
    """(session_cookie, csrf_cookie) for a bucket."""
    if bucket == _LEGACY_BUCKET:
        return settings.SESSION_COOKIE_NAME, settings.CSRF_COOKIE_NAME
    p = settings.SESSION_COOKIE_PREFIX
    return f"{p}_{bucket}_session", f"{p}_{bucket}_csrf"


def _bucket_from_cookie_name(name: str) -> str | None:
    if name == settings.SESSION_COOKIE_NAME:
        return _LEGACY_BUCKET
    p = f"{settings.SESSION_COOKIE_PREFIX}_"
    if name.startswith(p) and name.endswith("_session"):
        return name[len(p) : -len("_session")]
    return None


def _present_session_buckets(request: Request) -> dict[str, str]:
    """{bucket: token} for every session cookie present on the request."""
    out: dict[str, str] = {}
    for cname, value in request.cookies.items():
        b = _bucket_from_cookie_name(cname)
        if b and value:
            out[b] = value
    return out


def _requested_bucket(request: Request) -> str | None:
    """The bucket the caller asked for via `X-Session-Role` (accepts a role slug or a
    bucket name), or None if the header is absent."""
    sel = request.headers.get("X-Session-Role")
    if not sel:
        return None
    present = _present_session_buckets(request)
    if sel in present:
        return sel
    return bucket_for_role(sel)


def _select_session_token(request: Request) -> tuple[str, str]:
    """(bucket, token) for the session this request is acting under.

    Raises AuthError if nothing is present, or if several sessions are present and the
    caller did not disambiguate with `X-Session-Role`.
    """
    present = _present_session_buckets(request)
    if not present:
        raise AuthError("Not authenticated")
    if len(present) == 1:
        return next(iter(present.items()))
    want = _requested_bucket(request)
    if want is None:
        raise AuthError(
            "Multiple role sessions present — set the X-Session-Role header",
            code="AMBIGUOUS_SESSION",
        )
    if want not in present:
        raise AuthError(f"No '{want}' session present", code="SESSION_NOT_PRESENT")
    return want, present[want]


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
    db: AsyncSession,
    response: Response,
    user: User,
    request: Request,
    *,
    role_slug: str | None = None,
    community_id: uuid.UUID | None = None,
) -> UserSession:
    """Open a session for `user` acting as `role_slug`. The cookies are written to that
    role's bucket, so an existing session in another bucket is left untouched."""
    bucket = bucket_for_role(role_slug)
    session_cookie, csrf_cookie = session_cookie_names(bucket)
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(24)
    token_hash = _hash_token(token)
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.SESSION_TTL_SECONDS)

    session = UserSession(
        user_id=user.id,
        session_key_hash=token_hash,
        csrf_token=csrf,
        role_slug=role_slug,
        cookie_bucket=bucket,
        community_id=community_id,
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        created_at=now,
        expires_at=expires_at,
        last_activity_at=now,
    )
    db.add(session)
    await db.flush()

    _cache_put(
        token_hash,
        {
            "session_id": str(session.id),
            "user_id": str(user.id),
            "csrf": csrf,
            "bucket": bucket,
            "role_slug": role_slug,
        },
        settings.SESSION_TTL_SECONDS,
    )

    common = {
        "domain": settings.COOKIE_DOMAIN,
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE,
        "max_age": settings.SESSION_TTL_SECONDS,
        "path": "/",
    }
    response.set_cookie(session_cookie, token, httponly=True, **common)  # type: ignore[arg-type]
    response.set_cookie(csrf_cookie, csrf, httponly=False, **common)  # type: ignore[arg-type]
    return session


async def destroy_session(db: AsyncSession, request: Request, response: Response) -> None:
    """Revoke ONLY the session this request is authenticated under, and clear just that
    bucket's two cookies. Other role sessions in the same jar survive."""
    try:
        bucket, token = _select_session_token(request)
    except AuthError:
        return
    session_cookie, csrf_cookie = session_cookie_names(bucket)
    token_hash = _hash_token(token)
    _cache_drop(token_hash)
    row = await db.scalar(select(UserSession).where(UserSession.session_key_hash == token_hash))
    if row and row.revoked_at is None:
        row.revoked_at = datetime.now(UTC)
    response.delete_cookie(session_cookie, path="/", domain=settings.COOKIE_DOMAIN)
    response.delete_cookie(csrf_cookie, path="/", domain=settings.COOKIE_DOMAIN)


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
    header = request.headers.get("X-CSRF-Token")
    if not header:
        raise ForbiddenError("CSRF token missing or invalid", code="CSRF_INVALID")
    try:
        bucket, _ = _select_session_token(request)
    except AuthError:
        raise ForbiddenError("CSRF token missing or invalid", code="CSRF_INVALID") from None
    _, csrf_cookie = session_cookie_names(bucket)
    cookie = request.cookies.get(csrf_cookie)
    if not cookie or not secrets.compare_digest(cookie, header):
        raise ForbiddenError("CSRF token missing or invalid", code="CSRF_INVALID")


# --------------------------------------------------------------------------- #
# Dependencies (async — ADR-010)
# --------------------------------------------------------------------------- #
async def _load_session_async(db: AsyncSession, request: Request) -> dict:
    bucket, token = _select_session_token(request)
    token_hash = _hash_token(token)

    cached = _cache_get(token_hash)
    if cached:
        cached["_token_hash"] = token_hash
        cached.setdefault("bucket", bucket)
        return cached

    row = await db.scalar(select(UserSession).where(UserSession.session_key_hash == token_hash))
    if row is None:
        raise AuthError("Session not found")
    if row.revoked_at is not None:
        raise AuthError("Session revoked")
    if row.expires_at <= datetime.now(UTC):
        raise AuthError("Session expired")

    payload = {
        "session_id": str(row.id),
        "user_id": str(row.user_id),
        "csrf": row.csrf_token,
        "bucket": row.cookie_bucket or bucket,
        "role_slug": row.role_slug,
    }
    ttl = int((row.expires_at - datetime.now(UTC)).total_seconds())
    _cache_put(token_hash, payload, max(ttl, 1))
    payload["_token_hash"] = token_hash
    return payload


async def _touch_last_activity(db: AsyncSession, session_id: str) -> None:
    """Best-effort: advance `last_activity_at`, at most once per refresh window."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(seconds=settings.SESSION_ACTIVITY_REFRESH_SECONDS)
    with contextlib.suppress(Exception):
        await db.execute(
            update(UserSession)
            .where(
                UserSession.id == uuid.UUID(session_id),
                (UserSession.last_activity_at.is_(None)) | (UserSession.last_activity_at < cutoff),
            )
            .values(last_activity_at=now)
        )


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
    request.state.session_bucket = session.get("bucket")
    request.state.session_role = session.get("role_slug")
    request.state.user = user
    await _touch_last_activity(db, session["session_id"])
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


# `require_permission_async` lives in `app.core.tenancy` — it needs the resolved `TenantScope`
# so per-community RBAC overrides are enforced. Routers import it directly from `app.core.tenancy`
# (never re-exported here) so the dependency direction stays one-way: tenancy -> security.

"""Business logic for Authentication (FR-01).

`AuthService` orchestrates: credential verification (Argon2), the failed-login audit in
its own transaction, role resolution, session creation, and the `CurrentUser` view.

Auth is the one module that legitimately touches `Request`/`Response` directly — it reads
and writes session cookies and `request.state`. Every *other* service takes a framework-
agnostic `RequestContext` (`app/core/context.py`), never `Request`.
"""

from __future__ import annotations

import uuid

from fastapi import Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthError
from app.core.security import (
    create_session,
    destroy_session,
    hash_password,
    needs_rehash,
    user_permissions_async,
    verify_password,
)
from app.db.session import AsyncSessionLocal
from app.modules.audit.service import record_audit_async
from app.modules.auth.models import UserSession
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import CurrentUser
from app.modules.users.models import User


async def resolve_login_role(
    repo: AuthRepository, user: User, requested: str | None
) -> tuple[str, uuid.UUID | None]:
    """Pick the (role_slug, community_id) this login session acts under.

    - Super Admin always resolves to `super_admin` (global), regardless of `requested`.
    - `requested` given: must be a role the user actually holds -> that grant.
    - `requested` omitted: the user's sole distinct role, else 422 (the caller must choose,
      so the right `gatesphere_<bucket>_session` cookie is written).
    """
    if user.is_superadmin:
        return "super_admin", None
    grants = await repo.role_grants(user.id)
    if not grants:
        raise AuthError("This account has no role grants", code="NO_ROLE")
    if requested:
        matches = [g for g in grants if g[0] == requested]
        if not matches:
            raise AuthError(f"You do not hold the '{requested}' role", code="ROLE_NOT_GRANTED")
        return matches[0]
    distinct = {g[0] for g in grants}
    if len(distinct) == 1:
        return grants[0]
    raise AuthError(
        "This account holds multiple roles — pass `role` to choose which session to open",
        code="ROLE_REQUIRED",
        fields={"role": f"one of {sorted(distinct)}"},
    )


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AuthRepository(db)

    async def _serialize(
        self, user: User, *, role_slug: str | None = None, session_bucket: str | None = None
    ) -> CurrentUser:
        cids = await self.repo.community_ids(user.id)
        return CurrentUser(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            is_superadmin=user.is_superadmin,
            permissions=sorted(await user_permissions_async(self.db, user)),
            community_ids=sorted({str(c) for c in cids}),
            active_role=role_slug,
            session_bucket=session_bucket,
            permission_version=user.permission_version or 0,
        )

    async def login(
        self, request: Request, response: Response, *, email: str, password: str, role: str | None
    ) -> CurrentUser:
        user = await self.repo.user_by_email(email)
        if not user or not user.is_active or not verify_password(password, user.password_hash):
            # Failed logins are audited (FR-01) in their own transaction — the request
            # transaction is rolled back when the AuthError propagates.
            async with AsyncSessionLocal() as audit_db:
                await record_audit_async(
                    audit_db,
                    module="auth",
                    action="login.failed",
                    actor=user or None,
                    entity_type="user",
                    entity_id=str(user.id) if user else None,
                    new={"email": email.lower(), "reason": "invalid_credentials"},
                    request=request,
                )
                await audit_db.commit()
            raise AuthError("Invalid email or password", code="INVALID_CREDENTIALS")

        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)

        role_slug, community_id = await resolve_login_role(self.repo, user, role)
        session: UserSession = await create_session(
            self.db, response, user, request, role_slug=role_slug, community_id=community_id
        )
        await record_audit_async(
            self.db,
            module="auth",
            action="login.success",
            actor=user,
            community_id=community_id,
            entity_type="user",
            entity_id=str(user.id),
            new={"role": role_slug, "bucket": session.cookie_bucket},
            request=request,
            role_slug=role_slug,
        )
        return await self._serialize(
            user, role_slug=session.role_slug, session_bucket=session.cookie_bucket
        )

    async def logout(self, request: Request, response: Response, user: User) -> None:
        await destroy_session(self.db, request, response)
        await record_audit_async(
            self.db,
            module="auth",
            action="logout",
            actor=user,
            entity_type="user",
            entity_id=str(user.id),
            request=request,
            role_slug=getattr(request.state, "session_role", None),
        )

    async def me(self, request: Request, user: User) -> CurrentUser:
        return await self._serialize(
            user,
            role_slug=getattr(request.state, "session_role", None),
            session_bucket=getattr(request.state, "session_bucket", None),
        )

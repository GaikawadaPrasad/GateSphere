"""Business logic for User & Role management (FR-02). Async stack (ADR-010).

A global caller (Super Admin) manages every user. A community-scoped caller (Community Admin)
manages users **within their community** — a user with no roles, or one whose only roles are in
the caller's communities. Role grants can only target a community in the caller's scope.
Any grant / revoke / deactivate **revokes the target's live sessions** (permission change).
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.rbac import ROLE_PERMISSIONS
from app.core.security import (
    hash_password,
    invalidate_user_permissions_async,
    revoke_all_user_sessions_async,
)
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.users import schemas
from app.modules.users.models import Permission, Role, RolePermission, User, UserRole

_WITH_ROLES = (selectinload(User.roles).selectinload(UserRole.role),)


class UserService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx

    async def _audit(self, action, entity_id, *, community_id=None, **kw) -> None:
        await record_audit_async(
            self.db,
            module="users",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type="user",
            entity_id=entity_id,
            ctx=self.ctx,
            **kw,
        )

    # -- scope helpers -------------------------------------- #
    def _require_community(self, community_id: uuid.UUID | None) -> None:
        if community_id is None:
            if not self.scope.is_global:
                raise ForbiddenError(
                    "Only a global admin can make a platform-wide grant", code="GLOBAL_ONLY"
                )
            return
        self.scope.require(community_id)

    def _visible(self, user: User) -> bool:
        if self.scope.is_global:
            return True
        grant_cids = {ur.community_id for ur in user.roles if ur.community_id is not None}
        if not user.roles:
            return True  # unaffiliated user — claimable by any admin
        return bool(grant_cids & self.scope.community_ids)

    async def _get_visible(self, user_id: uuid.UUID) -> User:
        user = await self.db.scalar(
            select(User)
            .options(*_WITH_ROLES)
            .where(User.id == user_id)
            .execution_options(populate_existing=True)
        )
        if user is None or not self._visible(user):
            raise NotFoundError("User not found")
        return user

    # -- reads --------------------------------------------- #
    def _role_grant(self, ur: UserRole) -> schemas.RoleGrantRead:
        return schemas.RoleGrantRead(
            id=ur.id,
            created_at=ur.created_at,
            updated_at=ur.updated_at,
            user_id=ur.user_id,
            role_id=ur.role_id,
            role_slug=ur.role.slug,
            role_name=ur.role.name,
            community_id=ur.community_id,
        )

    def to_read(self, user: User) -> schemas.UserRead:
        return schemas.UserRead(
            id=user.id,
            created_at=user.created_at,
            updated_at=user.updated_at,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            is_active=user.is_active,
            is_superadmin=user.is_superadmin,
            roles=[self._role_grant(ur) for ur in user.roles],
        )

    async def list_users(
        self,
        *,
        q: str | None,
        role_slug: str | None,
        community_id: uuid.UUID | None,
        active: bool | None,
        offset: int,
        limit: int,
    ):
        stmt = select(User).options(*_WITH_ROLES)
        if q:
            stmt = stmt.where(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
        if active is not None:
            stmt = stmt.where(User.is_active.is_(active))
        if role_slug or community_id is not None or not self.scope.is_global:
            stmt = stmt.join(UserRole, UserRole.user_id == User.id, isouter=True)
            if role_slug:
                stmt = stmt.join(Role, Role.id == UserRole.role_id).where(Role.slug == role_slug)
            if community_id is not None:
                self.scope.require(community_id)
                stmt = stmt.where(UserRole.community_id == community_id)
            elif not self.scope.is_global:
                stmt = stmt.where(
                    or_(
                        UserRole.community_id.in_(self.scope.community_ids),
                        UserRole.id.is_(None),
                    )
                )
        stmt = stmt.distinct().order_by(User.email)
        total = int(
            await self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
            or 0
        )
        rows = list((await self.db.scalars(stmt.offset(offset).limit(limit))).all())
        return rows, total

    async def get_user(self, user_id: uuid.UUID) -> User:
        return await self._get_visible(user_id)

    async def list_roles(self) -> list[schemas.RoleRead]:
        roles = list((await self.db.scalars(select(Role).order_by(Role.slug))).all())
        out = []
        for r in roles:
            granted = ROLE_PERMISSIONS.get(r.slug, [])
            if granted == ["*"]:
                codes = ["*"]
            else:
                codes = sorted(
                    (
                        await self.db.scalars(
                            select(Permission.code)
                            .join(RolePermission, RolePermission.permission_id == Permission.id)
                            .where(RolePermission.role_id == r.id)
                        )
                    ).all()
                )
            out.append(
                schemas.RoleRead(
                    id=r.id, slug=r.slug, name=r.name, description=r.description, permissions=codes
                )
            )
        return out

    # -- writes -------------------------------------------- #
    async def create_user(self, payload: schemas.UserCreate) -> User:
        email = payload.email.lower()
        if await self.db.scalar(select(User).where(User.email == email)):
            raise ConflictError("Email already registered", code="EMAIL_TAKEN")
        user = User(
            email=email,
            full_name=payload.full_name,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
        )
        self.db.add(user)
        await self.db.flush()
        await self._audit("user.create", str(user.id))
        if payload.role_slug:
            await self.grant_role(
                user.id,
                schemas.RoleGrantIn(role_slug=payload.role_slug, community_id=payload.community_id),
            )
        return await self._get_visible(user.id)

    async def update_user(self, user_id: uuid.UUID, payload: schemas.UserUpdate) -> User:
        user = await self._get_visible(user_id)
        patch = payload.model_dump(exclude_unset=True)
        was_active = user.is_active
        for k, v in patch.items():
            setattr(user, k, v)
        await self.db.flush()
        if was_active and user.is_active is False:
            await revoke_all_user_sessions_async(self.db, user.id)
        await self._audit("user.update", str(user.id), new=patch)
        return await self._get_visible(user_id)

    async def grant_role(self, user_id: uuid.UUID, payload: schemas.RoleGrantIn) -> UserRole:
        user = await self._get_visible(user_id)
        role = await self.db.scalar(select(Role).where(Role.slug == payload.role_slug))
        if role is None:
            raise NotFoundError("Role not found")
        self._require_community(payload.community_id)
        if role.slug in ("super_admin", "auditor") and payload.community_id is not None:
            raise BusinessRuleError(
                f"{role.slug} is a platform-global role", code="GLOBAL_ROLE_ONLY"
            )
        dupe = await self.db.scalar(
            select(UserRole).where(
                UserRole.user_id == user.id,
                UserRole.role_id == role.id,
                UserRole.community_id == payload.community_id,
            )
        )
        if dupe is not None:
            raise ConflictError("Grant already exists", code="GRANT_EXISTS")
        ur = UserRole(user_id=user.id, role_id=role.id, community_id=payload.community_id)
        self.db.add(ur)
        await self.db.flush()
        await invalidate_user_permissions_async(self.db, [user.id])
        await self._audit(
            "role.grant",
            str(user.id),
            community_id=payload.community_id,
            new={"role": role.slug, "community_id": str(payload.community_id or "global")},
        )
        return await self.db.scalar(
            select(UserRole).options(selectinload(UserRole.role)).where(UserRole.id == ur.id)
        )

    async def revoke_role(self, user_id: uuid.UUID, grant_id: uuid.UUID) -> None:
        user = await self._get_visible(user_id)
        ur = await self.db.get(UserRole, grant_id)
        if ur is None or ur.user_id != user.id:
            raise NotFoundError("Grant not found")
        self._require_community(ur.community_id)
        await self.db.delete(ur)
        await self.db.flush()
        await invalidate_user_permissions_async(self.db, [user.id])
        await self._audit("role.revoke", str(user.id), community_id=ur.community_id)

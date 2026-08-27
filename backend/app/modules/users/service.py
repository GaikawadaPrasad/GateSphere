"""Business logic for User & Role management (FR-02).

A global caller (Super Admin) manages every user. A community-scoped caller (Community Admin)
manages users **within their community** — a user with no roles, or one whose only roles are in
the caller's communities. Role grants can only target a community in the caller's scope.
Any grant / revoke / deactivate **revokes the target's live sessions** (permission change).
"""

from __future__ import annotations

import uuid

from fastapi import Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.rbac import ROLE_PERMISSIONS
from app.core.security import hash_password, revoke_all_user_sessions
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.users import schemas
from app.modules.users.models import Permission, Role, RolePermission, User, UserRole


class UserService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request

    def _audit(self, action, entity_id, *, community_id=None, **kw):
        record_audit(
            self.db,
            module="users",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type="user",
            entity_id=entity_id,
            request=self.request,
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

    def _get_visible(self, user_id: uuid.UUID) -> User:
        user = self.db.get(User, user_id)
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

    def list_users(
        self,
        *,
        q: str | None,
        role_slug: str | None,
        community_id: uuid.UUID | None,
        active: bool | None,
        offset: int,
        limit: int,
    ):
        stmt = select(User)
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
        from sqlalchemy import func

        total = int(
            self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        )
        rows = list(self.db.scalars(stmt.offset(offset).limit(limit)).all())
        return rows, total

    def get_user(self, user_id: uuid.UUID) -> User:
        return self._get_visible(user_id)

    def list_roles(self) -> list[schemas.RoleRead]:
        roles = list(self.db.scalars(select(Role).order_by(Role.slug)).all())
        out = []
        for r in roles:
            granted = ROLE_PERMISSIONS.get(r.slug, [])
            if granted == ["*"]:
                codes = ["*"]
            else:
                codes = sorted(
                    self.db.scalars(
                        select(Permission.code)
                        .join(RolePermission, RolePermission.permission_id == Permission.id)
                        .where(RolePermission.role_id == r.id)
                    ).all()
                )
            out.append(
                schemas.RoleRead(
                    id=r.id, slug=r.slug, name=r.name, description=r.description, permissions=codes
                )
            )
        return out

    # -- writes -------------------------------------------- #
    def create_user(self, payload: schemas.UserCreate) -> User:
        email = payload.email.lower()
        if self.db.scalar(select(User).where(User.email == email)):
            raise ConflictError("Email already registered", code="EMAIL_TAKEN")
        user = User(
            email=email,
            full_name=payload.full_name,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
        )
        self.db.add(user)
        self.db.flush()
        self._audit("user.create", str(user.id))
        if payload.role_slug:
            self.grant_role(
                user.id,
                schemas.RoleGrantIn(role_slug=payload.role_slug, community_id=payload.community_id),
            )
        self.db.refresh(user)
        return user

    def update_user(self, user_id: uuid.UUID, payload: schemas.UserUpdate) -> User:
        user = self._get_visible(user_id)
        patch = payload.model_dump(exclude_unset=True)
        was_active = user.is_active
        for k, v in patch.items():
            setattr(user, k, v)
        self.db.flush()
        if was_active and user.is_active is False:
            revoke_all_user_sessions(self.db, user.id)
        self._audit("user.update", str(user.id), new=patch)
        return user

    def grant_role(self, user_id: uuid.UUID, payload: schemas.RoleGrantIn) -> UserRole:
        user = self._get_visible(user_id)
        role = self.db.scalar(select(Role).where(Role.slug == payload.role_slug))
        if role is None:
            raise NotFoundError("Role not found")
        self._require_community(payload.community_id)
        if role.slug in ("super_admin", "auditor") and payload.community_id is not None:
            raise BusinessRuleError(
                f"{role.slug} is a platform-global role", code="GLOBAL_ROLE_ONLY"
            )
        dupe = self.db.scalar(
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
        self.db.flush()
        revoke_all_user_sessions(self.db, user.id)
        self._audit(
            "role.grant",
            str(user.id),
            community_id=payload.community_id,
            new={"role": role.slug, "community_id": str(payload.community_id or "global")},
        )
        self.db.refresh(ur)
        return ur

    def revoke_role(self, user_id: uuid.UUID, grant_id: uuid.UUID) -> None:
        user = self._get_visible(user_id)
        ur = self.db.get(UserRole, grant_id)
        if ur is None or ur.user_id != user.id:
            raise NotFoundError("Grant not found")
        self._require_community(ur.community_id)
        self.db.delete(ur)
        self.db.flush()
        revoke_all_user_sessions(self.db, user.id)
        self._audit("role.revoke", str(user.id), community_id=ur.community_id)

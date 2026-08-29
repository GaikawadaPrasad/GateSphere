"""Users, roles and permissions (RBAC core).

RBAC: User -> UserRole (community-scoped or global) -> Role -> RolePermission -> Permission.
Permission strings are `"<module>:<action>"`, e.g. `"visitors:approve"`.
"""

from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TenantMixin, TimestampMixin, uuid_pk


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    # bumped whenever this user's effective permissions could have changed
    # (role grant/revoke, a global role's permission set, or a per-community override
    # for a role they hold). The frontend re-fetches `/auth/me` when it changes.
    permission_version: Mapped[int] = mapped_column(Integer, default=0)

    roles: Mapped[list[UserRole]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(String(512))

    permissions: Mapped[list[RolePermission]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str] = mapped_column(String(128), unique=True, index=True)  # "<module>:<action>"
    description: Mapped[str | None] = mapped_column(String(512))


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE")
    )

    role: Mapped[Role] = relationship(back_populates="permissions")
    permission: Mapped[Permission] = relationship()


class UserRole(Base, TimestampMixin):
    """A role grant. `community_id` NULL means a platform-global grant (Super Admin, Auditor)."""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", "community_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    community_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), index=True
    )

    user: Mapped[User] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship()


class CommunityRolePermission(Base, TimestampMixin, TenantMixin):
    """Per-community override of a role's default permission set (configurable RBAC).

    Effective permissions for a role **in a given community** =
        (global `role_permissions` for the role)  +  {allow overrides}  -  {deny overrides}

    Only a platform admin (`super_admin`) manages these rows.
    """

    __tablename__ = "community_role_permissions"
    __table_args__ = (
        CheckConstraint("effect IN ('allow', 'deny')", name="ck_crp_effect"),
        UniqueConstraint("community_id", "role_id", "permission_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE")
    )
    effect: Mapped[str] = mapped_column(String(5))  # "allow" | "deny"
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    note: Mapped[str | None] = mapped_column(String(255))

    role: Mapped[Role] = relationship()
    permission: Mapped[Permission] = relationship()

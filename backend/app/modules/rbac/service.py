"""Configurable RBAC (FR-02 extension).

- **Global role permissions** live in `role_permissions`; editing them changes the default
  for that role everywhere. `super_admin` (`is_wildcard`) is not editable.
- **Per-community overrides** live in `community_role_permissions` (`effect` = allow | deny);
  effective = global defaults + allows - denies, resolved per community in
  `app.core.security.user_permissions_async`.
- Every change bumps `permission_version` and revokes the live sessions of the affected
  users so they re-authenticate with the new permission set.

`ROLE_PERMISSIONS` in `app/core/rbac.py` is the **seed default** — `reset_role` restores it.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, NotFoundError
from app.core.rbac import PERMISSIONS, ROLE_PERMISSIONS
from app.core.security import invalidate_user_permissions_async, users_with_role_async
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Community
from app.modules.rbac import schemas
from app.modules.users.models import (
    CommunityRolePermission,
    Permission,
    Role,
    RolePermission,
    User,
)


class RbacService:
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
            module="rbac",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type="role_permission",
            entity_id=str(entity_id),
            ctx=self.ctx,
            **kw,
        )

    async def _perm_map(self) -> dict[str, Permission]:
        return {p.code: p for p in (await self.db.scalars(select(Permission))).all()}

    async def _role(self, slug: str) -> Role:
        role = await self.db.scalar(select(Role).where(Role.slug == slug))
        if role is None:
            raise NotFoundError("Role not found")
        return role

    async def _community(self, community_id: uuid.UUID) -> Community:
        c = await self.db.scalar(select(Community).where(Community.id == community_id))
        if c is None:
            raise NotFoundError("Community not found")
        self.scope.require(community_id)
        return c

    async def _codes_for_role(self, role_id: uuid.UUID) -> set[str]:
        return set(
            (
                await self.db.scalars(
                    select(Permission.code)
                    .join(RolePermission, RolePermission.permission_id == Permission.id)
                    .where(RolePermission.role_id == role_id)
                )
            ).all()
        )

    def _default_codes(self, slug: str) -> list[str]:
        granted = ROLE_PERMISSIONS.get(slug, [])
        return sorted(PERMISSIONS) if granted == ["*"] else sorted(granted)

    # -- reads -------------------------------------------------- #
    async def list_permissions(self) -> list[schemas.PermissionRead]:
        rows = (await self.db.scalars(select(Permission).order_by(Permission.code))).all()
        return [schemas.PermissionRead(code=p.code, description=p.description) for p in rows]

    async def list_roles(self) -> list[schemas.RolePermsRead]:
        roles = (await self.db.scalars(select(Role).order_by(Role.slug))).all()
        out = []
        for r in roles:
            wildcard = ROLE_PERMISSIONS.get(r.slug) == ["*"]
            codes = ["*"] if wildcard else sorted(await self._codes_for_role(r.id))
            out.append(
                schemas.RolePermsRead(
                    slug=r.slug,
                    name=r.name,
                    description=r.description,
                    is_wildcard=wildcard,
                    permissions=codes,
                    default_permissions=self._default_codes(r.slug),
                )
            )
        return out

    # -- global role permission editing ------------------------ #
    def _guard_editable(self, slug: str) -> None:
        if ROLE_PERMISSIONS.get(slug) == ["*"]:
            raise BusinessRuleError(
                f"'{slug}' is a wildcard role — its permissions are not editable",
                code="ROLE_NOT_EDITABLE",
            )

    async def _apply_global(self, slug: str, codes: set[str], action: str) -> schemas.RolePermsRead:
        self._guard_editable(slug)
        role = await self._role(slug)
        pmap = await self._perm_map()
        unknown = codes - pmap.keys()
        if unknown:
            raise BusinessRuleError(
                f"Unknown permission codes: {sorted(unknown)}", code="UNKNOWN_PERMISSION"
            )
        current = {
            rp.permission_id: rp
            for rp in (
                await self.db.scalars(
                    select(RolePermission).where(RolePermission.role_id == role.id)
                )
            ).all()
        }
        want_ids = {pmap[c].id for c in codes}
        for pid in want_ids - current.keys():
            self.db.add(RolePermission(role_id=role.id, permission_id=pid))
        for pid, rp in current.items():
            if pid not in want_ids:
                await self.db.delete(rp)
        await self.db.flush()
        await invalidate_user_permissions_async(
            self.db, await users_with_role_async(self.db, role.id)
        )
        await self._audit(action, role.id, new={"role": slug, "codes": sorted(codes)})
        return schemas.RolePermsRead(
            slug=role.slug,
            name=role.name,
            description=role.description,
            is_wildcard=False,
            permissions=sorted(await self._codes_for_role(role.id)),
            default_permissions=self._default_codes(slug),
        )

    async def set_role_permissions(
        self, slug: str, payload: schemas.RolePermsSet
    ) -> schemas.RolePermsRead:
        return await self._apply_global(slug, set(payload.permissions), "role.set_permissions")

    async def add_role_permission(self, slug: str, code: str) -> schemas.RolePermsRead:
        role = await self._role(slug)
        return await self._apply_global(
            slug, await self._codes_for_role(role.id) | {code}, "role.add_permission"
        )

    async def remove_role_permission(self, slug: str, code: str) -> schemas.RolePermsRead:
        role = await self._role(slug)
        return await self._apply_global(
            slug, await self._codes_for_role(role.id) - {code}, "role.remove_permission"
        )

    async def reset_role_permissions(self, slug: str) -> schemas.RolePermsRead:
        return await self._apply_global(
            slug, set(self._default_codes(slug)), "role.reset_permissions"
        )

    # -- per-community overrides ------------------------------ #
    async def list_community_overrides(
        self, community_id: uuid.UUID
    ) -> list[schemas.CommunityOverrideRead]:
        await self._community(community_id)
        rows = (
            await self.db.execute(
                select(CommunityRolePermission, Role.slug, Permission.code)
                .join(Role, Role.id == CommunityRolePermission.role_id)
                .join(Permission, Permission.id == CommunityRolePermission.permission_id)
                .where(CommunityRolePermission.community_id == community_id)
                .order_by(Role.slug, Permission.code)
            )
        ).all()
        return [
            schemas.CommunityOverrideRead(
                id=o.id,
                community_id=o.community_id,
                role_id=o.role_id,
                role_slug=slug,
                permission_code=code,
                effect=o.effect,
                note=o.note,
            )
            for (o, slug, code) in rows
        ]

    async def set_community_role_overrides(
        self, community_id: uuid.UUID, slug: str, payload: schemas.CommunityRoleOverridesSet
    ) -> schemas.EffectivePermsRead:
        await self._community(community_id)
        self._guard_editable(slug)
        role = await self._role(slug)
        pmap = await self._perm_map()
        want: dict[str, str] = {}
        for c in payload.allow:
            want[c] = "allow"
        for c in payload.deny:
            if c in want:
                raise BusinessRuleError(
                    f"'{c}' is in both allow and deny", code="CONFLICTING_OVERRIDE"
                )
            want[c] = "deny"
        unknown = want.keys() - pmap.keys()
        if unknown:
            raise BusinessRuleError(
                f"Unknown permission codes: {sorted(unknown)}", code="UNKNOWN_PERMISSION"
            )
        existing = {
            o.permission_id: o
            for o in (
                await self.db.scalars(
                    select(CommunityRolePermission).where(
                        CommunityRolePermission.community_id == community_id,
                        CommunityRolePermission.role_id == role.id,
                    )
                )
            ).all()
        }
        want_by_id = {pmap[c].id: eff for c, eff in want.items()}
        for pid, eff in want_by_id.items():
            if pid in existing:
                existing[pid].effect = eff
                existing[pid].note = payload.note
            else:
                self.db.add(
                    CommunityRolePermission(
                        community_id=community_id,
                        role_id=role.id,
                        permission_id=pid,
                        effect=eff,
                        note=payload.note,
                        created_by_user_id=self.actor.id,
                    )
                )
        for pid, o in existing.items():
            if pid not in want_by_id:
                await self.db.delete(o)
        await self.db.flush()
        await invalidate_user_permissions_async(
            self.db, await users_with_role_async(self.db, role.id, community_id)
        )
        await self._audit(
            "community_override.set",
            role.id,
            community_id=community_id,
            new={"role": slug, "allow": payload.allow, "deny": payload.deny},
        )
        return await self.effective_permissions(community_id, slug)

    async def remove_community_override(
        self, community_id: uuid.UUID, slug: str, code: str
    ) -> schemas.EffectivePermsRead:
        await self._community(community_id)
        role = await self._role(slug)
        perm = await self.db.scalar(select(Permission).where(Permission.code == code))
        if perm is None:
            raise NotFoundError("Permission not found")
        obj = await self.db.scalar(
            select(CommunityRolePermission).where(
                CommunityRolePermission.community_id == community_id,
                CommunityRolePermission.role_id == role.id,
                CommunityRolePermission.permission_id == perm.id,
            )
        )
        if obj is None:
            raise NotFoundError("Override not found")
        await self.db.delete(obj)
        await self.db.flush()
        await invalidate_user_permissions_async(
            self.db, await users_with_role_async(self.db, role.id, community_id)
        )
        await self._audit(
            "community_override.remove", role.id, community_id=community_id, new={"code": code}
        )
        return await self.effective_permissions(community_id, slug)

    async def effective_permissions(
        self, community_id: uuid.UUID, slug: str
    ) -> schemas.EffectivePermsRead:
        await self._community(community_id)
        role = await self._role(slug)
        if ROLE_PERMISSIONS.get(slug) == ["*"]:
            allp = sorted(PERMISSIONS)
            return schemas.EffectivePermsRead(
                community_id=community_id,
                role_slug=slug,
                default_permissions=allp,
                allow=[],
                deny=[],
                effective_permissions=allp,
            )
        base = await self._codes_for_role(role.id)
        rows = (
            await self.db.execute(
                select(Permission.code, CommunityRolePermission.effect)
                .join(
                    CommunityRolePermission,
                    CommunityRolePermission.permission_id == Permission.id,
                )
                .where(
                    CommunityRolePermission.community_id == community_id,
                    CommunityRolePermission.role_id == role.id,
                )
            )
        ).all()
        allow = sorted(c for (c, e) in rows if e == "allow")
        deny = sorted(c for (c, e) in rows if e == "deny")
        effective = (base | set(allow)) - set(deny)
        return schemas.EffectivePermsRead(
            community_id=community_id,
            role_slug=slug,
            default_permissions=sorted(base),
            allow=allow,
            deny=deny,
            effective_permissions=sorted(effective),
        )

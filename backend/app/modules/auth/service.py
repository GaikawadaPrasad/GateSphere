"""Business logic for Authentication.

Rules live here: permission checks beyond role gates, state transitions, invariants,
transaction orchestration, event emission. Depends on repository, never on FastAPI.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthError
from app.modules.users.models import Role, User, UserRole


async def user_role_grants(db: AsyncSession, user: User) -> list[tuple[str, uuid.UUID | None]]:
    """[(role_slug, community_id | None)] for every grant the user holds."""
    rows = (
        await db.execute(
            select(Role.slug, UserRole.community_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id)
        )
    ).all()
    return [(slug, cid) for slug, cid in rows]


async def resolve_login_role(
    db: AsyncSession, user: User, requested: str | None
) -> tuple[str, uuid.UUID | None]:
    """Pick the (role_slug, community_id) this login session acts under.

    - Super Admin always resolves to `super_admin` (global), regardless of `requested`.
    - `requested` given: must be a role the user actually holds -> that grant.
    - `requested` omitted: the user's sole grant, else 422 (the caller must choose,
      so the right `gatesphere_<bucket>_session` cookie is written).
    """
    if user.is_superadmin:
        return "super_admin", None

    grants = await user_role_grants(db, user)
    if not grants:
        raise AuthError("This account has no role grants", code="NO_ROLE")

    if requested:
        matches = [g for g in grants if g[0] == requested]
        if not matches:
            raise AuthError(f"You do not hold the '{requested}' role", code="ROLE_NOT_GRANTED")
        return matches[0]

    distinct_slugs = {g[0] for g in grants}
    if len(distinct_slugs) == 1:
        return grants[0]
    raise AuthError(
        "This account holds multiple roles — pass `role` to choose which session to open",
        code="ROLE_REQUIRED",
        fields={"role": f"one of {sorted(distinct_slugs)}"},
    )

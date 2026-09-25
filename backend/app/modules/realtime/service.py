"""Realtime channel rules (AGENTS.md §5.7) — framework-agnostic.

- **Tickets**: an authenticated session exchanges its cookie for a random single-use ticket
  (`TICKET_TTL_SECONDS`, stored hashed in Redis). The socket presents it once; the client
  never stores it. No cookie/CSRF is involved in the upgrade itself.
- **Subscriptions**: every `subscribe` re-checks membership and resolves the caller's
  effective permissions *for that community* (overrides included). Only modules the caller
  can `:view` are forwarded.
- **Plain residents** (unit-restricted) get community hints only for community-wide modules;
  everything about their own unit reaches them on their personal user channel (a
  notification), so one resident's change never makes the whole community refetch.
- The actor of a change never receives its own hint (their UI already refreshed).
"""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from dataclasses import dataclass, field

from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client, rkey
from app.core.security import user_permissions_async
from app.modules.realtime import repository
from app.modules.residents.access import actor_unit_scope
from app.modules.users.models import User

TICKET_TTL_SECONDS = 30
# Community-level hints a unit-restricted resident may receive: data every resident of
# the community sees (notices, broadcasts, shared amenity availability).
RESIDENT_COMMUNITY_MODULES = frozenset({"communication", "notifications", "amenities"})


class RealtimeUnavailable(Exception):
    """Redis (the ticket store) is unreachable — clients fall back to polling."""


def _ticket_key(token: str) -> str:
    return rkey("rt", "ticket", hashlib.sha256(token.encode()).hexdigest())


def issue_ticket(user_id: uuid.UUID, session_id: str) -> tuple[str, int]:
    token = secrets.token_urlsafe(32)
    try:
        redis_client.setex(
            _ticket_key(token),
            TICKET_TTL_SECONDS,
            json.dumps({"user_id": str(user_id), "session_id": session_id}),
        )
    except RedisError as exc:
        raise RealtimeUnavailable from exc
    return token, TICKET_TTL_SECONDS


def consume_ticket(token: str) -> tuple[uuid.UUID, uuid.UUID] | None:
    """Single use: GETDEL, so a replayed / leaked ticket is worthless."""
    if not token or len(token) > 128:
        return None
    try:
        raw = redis_client.getdel(_ticket_key(token))
    except RedisError:
        return None
    if not raw:
        return None
    try:
        data = json.loads(str(raw))
        return uuid.UUID(data["user_id"]), uuid.UUID(data["session_id"])
    except (ValueError, KeyError, TypeError):
        return None


async def authenticate(db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID) -> User | None:
    return await repository.live_session_user(db, session_id, user_id)


@dataclass(frozen=True)
class CommunityGrant:
    community_id: uuid.UUID
    view_all: bool
    view_modules: frozenset[str] = field(default_factory=frozenset)
    unit_restricted: bool = False

    def allows(self, module: str) -> bool:
        if self.unit_restricted and module not in RESIDENT_COMMUNITY_MODULES:
            return False
        return self.view_all or module in self.view_modules


async def authorize_community(
    db: AsyncSession, user: User, community_id: uuid.UUID
) -> CommunityGrant | None:
    """None when `user` may not follow `community_id` (→ the caller answers 'forbidden',
    never revealing whether the community exists)."""
    if not user.is_superadmin:
        grants = await repository.community_grants(db, user.id)
        if community_id not in grants and None not in grants:
            return None
    perms = await user_permissions_async(db, user, community_id=community_id)
    view_all = "*" in perms
    modules = frozenset(p.split(":", 1)[0] for p in perms if p.endswith(":view"))
    if not view_all and not modules:
        return None
    restricted = (await actor_unit_scope(db, user, community_id=community_id)) is not None
    return CommunityGrant(community_id, view_all, modules, restricted)


async def default_community(db: AsyncSession, user: User) -> uuid.UUID | None:
    """Auto-subscribe target: the single community of a single-community member."""
    if user.is_superadmin:
        return None
    grants = await repository.community_grants(db, user.id)
    ids = {g for g in grants if g is not None}
    if None in grants or len(ids) != 1:
        return None
    return next(iter(ids))


def client_payload(event: dict, user_id: uuid.UUID, grant: CommunityGrant | None) -> dict | None:
    """The hint as sent to one connection, or None if it must not be forwarded."""
    if event.get("actor_id") and event["actor_id"] == str(user_id):
        return None
    module = str(event.get("module") or "")
    if event.get("scope") == "community":
        if grant is None or event.get("community_id") != str(grant.community_id):
            return None
        if not grant.allows(module):
            return None
    return {
        "type": "invalidate",
        "scope": event.get("scope"),
        "module": module,
        "entity": event.get("entity"),
        "action": event.get("action"),
    }

"""Per-process WebSocket hub: connection registry + one Redis pub/sub subscriber.

Each API worker runs at most one subscriber task (started with the first connection,
stopped with the last) that pattern-subscribes to every community and user channel and
fans hints out to the local connections. Each connection has a bounded outbox drained by
its own sender task, so a slow client can never stall the fan-out; on overflow the client
gets one `resync` (refetch whatever is on screen) instead of an unbounded backlog.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import uuid
from dataclasses import dataclass, field
from typing import Protocol

import redis.asyncio as aioredis
import structlog
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.realtime import COMMUNITY_CHANNEL_PREFIX, USER_CHANNEL_PREFIX
from app.modules.realtime.service import CommunityGrant, client_payload

log = structlog.get_logger(__name__)

OUTBOX_SIZE = 64
MAX_CONNECTIONS_PER_USER = 10


class Socket(Protocol):
    async def send_text(self, data: str) -> None: ...


@dataclass(eq=False)
class Connection:
    socket: Socket
    user_id: uuid.UUID
    grant: CommunityGrant | None = None
    outbox: asyncio.Queue[str] = field(default_factory=lambda: asyncio.Queue(OUTBOX_SIZE))
    overflowed: bool = False

    def offer(self, message: dict) -> None:
        if self.overflowed:
            return
        try:
            self.outbox.put_nowait(json.dumps(message, separators=(",", ":")))
        except asyncio.QueueFull:
            self.overflowed = True  # sender emits a single resync once it catches up

    async def sender(self) -> None:
        while True:
            text = await self.outbox.get()
            await self.socket.send_text(text)
            if self.overflowed and self.outbox.empty():
                self.overflowed = False
                await self.socket.send_text('{"type":"resync"}')


class Hub:
    def __init__(self) -> None:
        self._by_user: dict[uuid.UUID, set[Connection]] = {}
        self._task: asyncio.Task | None = None

    def can_open(self, user_id: uuid.UUID) -> bool:
        return len(self._by_user.get(user_id, ())) < MAX_CONNECTIONS_PER_USER

    def add(self, conn: Connection) -> None:
        self._by_user.setdefault(conn.user_id, set()).add(conn)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._subscribe_forever())

    def remove(self, conn: Connection) -> None:
        conns = self._by_user.get(conn.user_id)
        if conns is not None:
            conns.discard(conn)
            if not conns:
                self._by_user.pop(conn.user_id, None)
        if not self._by_user and self._task is not None:
            self._task.cancel()
            self._task = None

    def dispatch(self, channel: str, raw: str) -> None:
        try:
            event = json.loads(raw)
        except ValueError:
            return
        if channel.startswith(USER_CHANNEL_PREFIX + ":"):
            try:
                uid = uuid.UUID(channel.rsplit(":", 1)[1])
            except ValueError:
                return
            targets = list(self._by_user.get(uid, ()))
        else:
            targets = [c for conns in self._by_user.values() for c in conns if c.grant is not None]
        for conn in targets:
            msg = client_payload(event, conn.user_id, conn.grant)
            if msg is not None:
                conn.offer(msg)

    async def _subscribe_forever(self) -> None:
        backoff = 1.0
        while self._by_user:
            client = aioredis.Redis.from_url(
                str(settings.REDIS_URL), decode_responses=True, socket_connect_timeout=2.0
            )
            try:
                async with client.pubsub() as pubsub:
                    await pubsub.psubscribe(
                        f"{COMMUNITY_CHANNEL_PREFIX}:*", f"{USER_CHANNEL_PREFIX}:*"
                    )
                    backoff = 1.0
                    async for msg in pubsub.listen():
                        if msg.get("type") == "pmessage":
                            self.dispatch(msg["channel"], msg["data"])
            except asyncio.CancelledError:
                raise
            except (RedisError, OSError) as exc:
                log.debug("realtime.subscriber_error", error=type(exc).__name__)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
            finally:
                with contextlib.suppress(Exception):
                    await client.aclose()


_hubs: dict[int, Hub] = {}


def hub() -> Hub:
    """The hub for the running event loop (one per worker process in production)."""
    loop_id = id(asyncio.get_running_loop())
    if loop_id not in _hubs:
        _hubs.clear()  # a new loop means the old one is gone (tests); drop stale hubs
        _hubs[loop_id] = Hub()
    return _hubs[loop_id]

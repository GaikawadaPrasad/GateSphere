"""Realtime API — `POST /realtime/ticket` + `WS /realtime/ws` (AGENTS.md §5.7).

Protocol (JSON text frames):
  server → `{"type":"hello","community_id":<auto-subscribed or null>}`
  client → `{"type":"subscribe","community_id":"<uuid>"}`  → `subscribed` | `error`
  client → `{"type":"ping"}` → `{"type":"pong"}`
  server → `{"type":"invalidate","scope":"community|user","module":...,"entity":...,"action":...}`
  server → `{"type":"resync"}` (outbox overflowed — refetch what is on screen)
Close codes: 4401 bad/expired ticket or session revoked · 4403 origin not allowed ·
4429 too many connections for this user.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import uuid

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.errors import AppError
from app.core.responses import Response as Envelope
from app.core.responses import ok
from app.core.security import require_auth_async
from app.db.session import AsyncSessionLocal
from app.modules.realtime import schemas, service
from app.modules.realtime.hub import Connection, hub
from app.modules.users.models import User

router = APIRouter(prefix="/realtime", tags=["Realtime"])

SESSION_RECHECK_SECONDS = 300
IDLE_TIMEOUT_SECONDS = 90  # the client pings every 25 s; silence means a dead peer


class RealtimeUnavailableError(AppError):
    status_code = 503
    code = "REALTIME_UNAVAILABLE"


@router.post(
    "/ticket",
    response_model=Envelope[schemas.TicketRead],
    summary="Issue a single-use, 30-second WebSocket ticket for the current session",
)
async def issue_ticket(request: Request, user: User = Depends(require_auth_async)) -> dict:
    try:
        token, ttl = service.issue_ticket(user.id, request.state.session_id)
    except service.RealtimeUnavailable as exc:
        raise RealtimeUnavailableError("Realtime updates are temporarily unavailable") from exc
    return ok(schemas.TicketRead(ticket=token, expires_in=ttl))


def _origin_allowed(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    # Cross-site WebSocket hijacking guard: a browser always sends Origin.
    return origin is None or origin in settings.cors_allow_origins


@router.websocket("/ws")
async def realtime_socket(ws: WebSocket, ticket: str = "") -> None:
    if not _origin_allowed(ws):
        await ws.close(code=4403)
        return
    ident = service.consume_ticket(ticket)
    if ident is None:
        await ws.close(code=4401)
        return
    user_id, session_id = ident
    async with AsyncSessionLocal() as db:
        user = await service.authenticate(db, user_id, session_id)
        if user is None:
            await ws.close(code=4401)
            return
        h = hub()
        if not h.can_open(user.id):
            await ws.close(code=4429)
            return
        default_cid = await service.default_community(db, user)
        grant = await service.authorize_community(db, user, default_cid) if default_cid else None
    await ws.accept()
    conn = Connection(socket=ws, user_id=user.id, grant=grant)
    h.add(conn)
    sender = asyncio.create_task(conn.sender())
    watchdog = asyncio.create_task(_revalidate(ws, user_id, session_id))
    try:
        await ws.send_text(
            json.dumps(
                {"type": "hello", "community_id": str(grant.community_id) if grant else None}
            )
        )
        while True:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=IDLE_TIMEOUT_SECONDS)
            await _handle(conn, user, raw)
    except (WebSocketDisconnect, TimeoutError, RuntimeError):
        pass
    finally:
        h.remove(conn)
        for task in (sender, watchdog):
            task.cancel()
        with contextlib.suppress(Exception):
            await ws.close()


async def _handle(conn: Connection, user: User, raw: str) -> None:
    try:
        msg = json.loads(raw)
    except ValueError:
        return
    if not isinstance(msg, dict):
        return
    kind = msg.get("type")
    if kind == "ping":
        conn.offer({"type": "pong"})
    elif kind == "subscribe":
        try:
            cid = uuid.UUID(str(msg.get("community_id")))
        except ValueError:
            conn.offer({"type": "error", "code": "INVALID_COMMUNITY"})
            return
        async with AsyncSessionLocal() as db:
            grant = await service.authorize_community(db, user, cid)
        if grant is None:
            # Same answer whether the community is foreign or doesn't exist (no oracle).
            conn.offer({"type": "error", "code": "FORBIDDEN_SCOPE"})
            return
        conn.grant = grant
        conn.offer({"type": "subscribed", "community_id": str(cid)})
    # unknown message types are ignored (forward compatibility)


async def _revalidate(ws: WebSocket, user_id: uuid.UUID, session_id: uuid.UUID) -> None:
    """Close the socket once its session is revoked / expired or the user deactivated."""
    while True:
        await asyncio.sleep(SESSION_RECHECK_SECONDS)
        async with AsyncSessionLocal() as db:
            if await service.authenticate(db, user_id, session_id) is None:
                with contextlib.suppress(Exception):
                    await ws.close(code=4401)
                return

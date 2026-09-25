"""Realtime channel — tickets, socket auth, subscription authorization, hint routing."""

from __future__ import annotations

import time
import uuid

import pytest
from starlette.websockets import WebSocketDisconnect

from app.modules.realtime.service import CommunityGrant, client_payload

WS = "/api/v1/realtime/ws"
TICKET = "/api/v1/realtime/ticket"


def _plate() -> str:
    return "RT" + str(uuid.uuid4().int)[:8]


def _ticket(client) -> str:
    r = client.post(TICKET)
    assert r.status_code == 200, r.text
    return r.json()["data"]["ticket"]


def _collect(ws, *, want_module: str | None, rounds: int = 12) -> list[dict]:
    """Ping repeatedly (each ping guarantees one reply, so this never blocks) and gather
    messages until an `invalidate` for `want_module` arrives or the rounds run out."""
    got: list[dict] = []
    for _ in range(rounds):
        ws.send_json({"type": "ping"})
        while True:
            msg = ws.receive_json()
            got.append(msg)
            if msg["type"] == "invalidate" and msg["module"] == want_module:
                return got
            if msg["type"] == "pong":
                break
        time.sleep(0.25)
    return got


# -- pure rules --------------------------------------------------------------------- #
def test_client_payload_rules():
    me, other, cid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    ev = {"scope": "community", "module": "vehicles", "community_id": str(cid), "actor_id": None}
    staff = CommunityGrant(cid, view_all=False, view_modules=frozenset({"vehicles"}))
    resident = CommunityGrant(cid, False, frozenset({"vehicles", "communication"}), True)
    assert client_payload(ev, me, staff)["module"] == "vehicles"
    assert "actor_id" not in client_payload(ev, me, staff)  # never leaked to clients
    assert client_payload({**ev, "actor_id": str(me)}, me, staff) is None  # actor excluded
    assert client_payload(ev, me, resident) is None  # unit-scoped module → user channel only
    assert client_payload({**ev, "module": "communication"}, me, resident) is not None
    assert client_payload({**ev, "module": "billing"}, me, staff) is None  # no billing:view
    assert client_payload({**ev, "community_id": str(uuid.uuid4())}, me, staff) is None
    assert client_payload(ev, me, None) is None  # not subscribed
    user_ev = {"scope": "user", "module": "visitors", "actor_id": str(other)}
    assert client_payload(user_ev, me, None)["module"] == "visitors"


# -- tickets & socket auth ------------------------------------------------------------ #
def test_ticket_requires_session(client):
    assert client.post(TICKET).status_code in (401, 403)  # CSRF/auth gate before the handler


def test_bad_ticket_is_rejected(client):
    with pytest.raises(WebSocketDisconnect) as exc, client.websocket_connect(f"{WS}?ticket=nope"):
        pass
    assert exc.value.code == 4401


def test_ticket_is_single_use(as_role):
    guard = as_role("security_guard")
    ticket = _ticket(guard)
    with guard.websocket_connect(f"{WS}?ticket={ticket}") as ws:
        assert ws.receive_json()["type"] == "hello"
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        guard.websocket_connect(f"{WS}?ticket={ticket}"),
    ):
        pass
    assert exc.value.code == 4401


def test_foreign_origin_is_rejected(as_role):
    guard = as_role("security_guard")
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        guard.websocket_connect(
            f"{WS}?ticket={_ticket(guard)}", headers={"origin": "https://evil.example"}
        ),
    ):
        pass
    assert exc.value.code == 4403


def test_cannot_subscribe_to_foreign_community(as_role, seed_ids):
    sup = as_role("security_supervisor")
    with sup.websocket_connect(f"{WS}?ticket={_ticket(sup)}") as ws:
        hello = ws.receive_json()
        mine = hello["community_id"]
        foreign = (
            seed_ids["other_community_id"]
            if mine != seed_ids["other_community_id"]
            else seed_ids["primary_community_id"]
        )
        ws.send_json({"type": "subscribe", "community_id": foreign})
        assert ws.receive_json() == {"type": "error", "code": "FORBIDDEN_SCOPE"}
        ws.send_json({"type": "subscribe", "community_id": str(uuid.uuid4())})
        assert ws.receive_json() == {"type": "error", "code": "FORBIDDEN_SCOPE"}  # no oracle


# -- end-to-end hint routing ---------------------------------------------------------- #
def test_staff_receive_hint_but_actor_and_resident_do_not(as_role):
    guard, sup, resident = (
        as_role("security_guard"),
        as_role("security_supervisor"),
        as_role("resident"),
    )
    with (
        sup.websocket_connect(f"{WS}?ticket={_ticket(sup)}") as sup_ws,
        guard.websocket_connect(f"{WS}?ticket={_ticket(guard)}") as guard_ws,
        resident.websocket_connect(f"{WS}?ticket={_ticket(resident)}") as res_ws,
    ):
        for ws in (sup_ws, guard_ws, res_ws):
            assert ws.receive_json()["type"] == "hello"
        time.sleep(0.5)  # let the hub's pattern subscription settle
        entry = guard.post("/api/v1/vehicles/entries", json={"registration_number": _plate()})
        assert entry.status_code == 201, entry.text
        try:
            sup_msgs = _collect(sup_ws, want_module="vehicles")
            assert any(
                m["type"] == "invalidate" and m["module"] == "vehicles" for m in sup_msgs
            ), sup_msgs
            hint = next(m for m in sup_msgs if m["type"] == "invalidate")
            assert set(hint) == {"type", "scope", "module", "entity", "action"}  # no data
            # the actor's own socket and a plain resident get nothing for this change
            for ws in (guard_ws, res_ws):
                msgs = _collect(ws, want_module="vehicles", rounds=3)
                assert not any(m["type"] == "invalidate" for m in msgs), msgs
        finally:
            guard.patch(f"/api/v1/vehicles/entries/{entry.json()['data']['id']}/exit")

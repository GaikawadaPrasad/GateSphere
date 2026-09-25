# Module: Realtime (cross-cutting, AGENTS.md §5.7)

> Decision record: [ADR-011](../../../decisions/ADR-011-realtime-websocket.md).

## What it does
Pushes **change hints** to connected browsers so dashboards refresh the moment data changes,
instead of polling. A hint names the module that changed; the frontend invalidates the matching
queries and re-reads them through the normal REST API.

## Flow
1. A service writes an audit row (`record_audit_async`) → `app/core/realtime.py` queues a
   community hint on the DB session. Notification dispatch queues a user hint.
2. `get_async_db` / `job_session` commit, then publish the queue to Redis
   (`gs:rt:community:<id>`, `gs:rt:user:<id>`); a rollback discards it.
3. Each API worker's hub (`hub.py`) pattern-subscribes once and forwards to its local sockets
   after `service.client_payload` filtering (actor excluded, `:view` required, resident rules).
4. `frontend/hooks/use-realtime.ts` routes the hint → query-key prefixes → debounced
   `invalidateQueries({ refetchType: "active" })`. Screens that load with `useState` use
   `useRealtimeRefresh(modules, reload, fallbackMs)`.

## API
| Route | Auth | Notes |
|---|---|---|
| `POST /api/v1/realtime/ticket` | session + CSRF | → `{ticket, expires_in: 30}`, single use; `503 REALTIME_UNAVAILABLE` if Redis is down |
| `WS /api/v1/realtime/ws?ticket=` | ticket | frames: `hello`, `subscribe` → `subscribed` / `error FORBIDDEN_SCOPE`, `ping` → `pong`, `invalidate`, `resync`. Close codes: 4401 ticket/session, 4403 origin, 4429 more than 10 sockets for the user |

## Rules
- Silent: the `auth`, `uploads`, `assistant` modules and per-recipient `notification.dispatch`
  audit rows (the recipient's user channel covers them). A broadcast emits one community hint.
- Residents (unit-restricted): community hints only for `communication`, `notifications`,
  `amenities`; everything else arrives on their user channel.
- Session re-checked every 5 minutes; a socket silent for 90 s (no ping) is closed.

## Tests
`app/modules/realtime/tests/test_realtime.py` — payload rules, auth, single-use ticket, origin
guard, cross-tenant subscribe, end-to-end delivery with actor/resident exclusion.
Frontend: `__tests__/unit/realtime-bridge.test.tsx`, `__tests__/unit/tab-gated-queries.test.tsx`.

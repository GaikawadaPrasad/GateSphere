# ADR-011 — Realtime change hints over one WebSocket per tab

**Status:** Accepted (2026-09-25) · **Supersedes:** AGENTS.md §23 "short polling only; add SSE/WS only if polling proves insufficient"

## Context
Dashboards kept data fresh by polling on fixed timers (SOS every 4–5 s, visitors/deliveries
every 5–10 s, notifications every 30 s, plus refetch-on-focus). Combined with dashboard views
that loaded every tab's data on every module page, a single idle resident tab issued dozens of
requests per minute while nothing changed. The product owner asked for WebSockets.

## Decision
- **Hints, not data.** The socket carries `{type:"invalidate", module, entity, action}`. The
  client invalidates the matching TanStack Query prefixes (active queries only, debounced
  750 ms). The REST API remains the only read path — no second public schema, and every read
  keeps its RBAC / tenant / own-unit checks.
- **One emit point.** `record_audit_async` queues a community hint for every audited change
  (all state changes are audited — §10), and notification dispatch queues a user hint. Hints
  are published to Redis pub/sub **after commit** (`get_async_db`, `job_session`) and dropped
  on rollback.
- **Auth.** `POST /realtime/ticket` (session + CSRF) → single-use 30 s ticket (hashed, Redis,
  GETDEL). `WS /realtime/ws?ticket=` checks Origin against the CORS allow-list (CSWSH guard),
  re-validates the session every 5 min and closes on revocation (4401).
- **Authorization per subscribe.** Membership + effective permissions for that community
  (overrides included) on every `subscribe`; only modules with `:view` are forwarded; foreign
  and non-existent communities get the same `FORBIDDEN_SCOPE` (no oracle). Plain residents
  get community hints only for community-wide modules (communication, notifications,
  amenities); their own-unit changes reach them as personal notifications, so one flat's
  activity never makes the whole community refetch. The actor never receives their own hint.
- **Fan-out.** One `psubscribe` per API worker; bounded per-connection outbox (overflow →
  a single `resync`); at most 10 sockets per user.
- **Optimisation, never a dependency.** While the socket is down the previous intervals apply
  (`useLivePollInterval`, `useRealtimeRefresh`); after a reconnect the client refreshes what is
  on screen once. SOS keeps a 60 s safety poll even with a healthy socket.

## Consequences
- Idle dashboards make no periodic HTTP requests while connected (heartbeat is a WS ping).
- Redis outage ⇒ hints dropped, clients poll — availability unaffected (§9.1).
- A hint for a module you can view but whose specific row you can't see still costs one
  scoped refetch (no ids are sent, by design).
- Hosts whose rewrites can't carry WebSocket upgrades (Vercel) connect the socket straight to
  the API origin (`NEXT_PUBLIC_REALTIME_URL`, derived at build time from
  `BACKEND_INTERNAL_URL`); the ticket makes this safe without cross-site cookies. The API's
  `FRONTEND_ORIGIN`/`CORS_ORIGINS` must include the UI origin. After 5 failed attempts the
  client stops retrying for the page session (polling covers it).

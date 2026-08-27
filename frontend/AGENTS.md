# frontend/AGENTS.md — Next.js specifics

Extends the root [`../AGENTS.md`](../AGENTS.md) (read it first — especially §3 RBAC/tenancy,
§5 frontend how-to, §6 API contract). Root rules win on any conflict.

## Stack
Next.js App Router · React 18+ · **TypeScript strict** · **Tailwind CSS** · **shadcn/ui** ·
**TanStack Query** (server state) · **Zustand / Context** (client state) · **React Hook Form + Zod**
(forms) · **Recharts** (charts) · **TanStack Table** (data tables).

## Layering
`page / component → hook (TanStack Query / mutation) → lib/api client → /api/v1`.
Components never call `fetch` directly.

## Route groups (`app/`)
`(public)/` login · forgot-password · reset-password — `(protected)/` all modules
(dashboard, communities, towers, floors, units, residents, visitors, gate, deliveries,
domestic-staff, vehicles, parking, violations, billing, payments, complaints, amenities,
communications, notifications, incidents, reports, audit-logs, profile) — `(unauthorized)/` the
403 screen. Also `components/{ui,<module>}/`, `features/`, `lib/`, `hooks/`, `store/`, `types/`,
`middleware.ts`.

Role landing routes: `super_admin → /admin/global`, `community_admin → /admin/community`,
`security_guard → /gate/live`, `resident → /resident/home`.

## Server vs Client
- Default to Server Components — role-appropriate shell, static chrome, initial dashboard fetch.
- `"use client"` only for state / effects / event handlers / browser APIs.
- The **Security Gate dashboard** is client-heavy, target **< 2s load**, live updates via short
  polling or SSE/WebSocket, no full-page refresh on approve/deny.

## State (strict split)
- **Server state → TanStack Query.** Stable keys (`["visitors", communityId, filters]`). Each
  mutation invalidates exactly the affected keys — never a blanket invalidate. After success,
  reconcile against the authoritative server response.
- **Client/UI state → Zustand / Context.** Auth user, active role, active community, sidebar,
  notification tray, filters, UI prefs, wizard steps.
- **Never** store session/security data in `localStorage` / `sessionStorage`.
- User/role/community context comes from `/api/v1/auth/me` via a top-level auth context.

## Forms
- **React Hook Form + Zod** everywhere; the Zod schema mirrors the backend contract.
- Client validation is UX only — the server's `422` (with `error.fields`) is the source of truth;
  map field errors back onto the form.

## Data-screen state machine (every list/detail)
`Idle → Loading → Success | Empty | Error → Retry`. Handle all four states explicitly — no
infinite spinners, always an empty state, always a retry action on error.

## HTTP status handling
`401` → redirect `/login` (preserve `next`). `403` → access-denied screen/toast, render **no**
data. `404` → "no longer available", refresh list. `409` → show conflict detail from
`error.message`, block resubmit. `422` → field errors. `429` → cooldown timer. `5xx` → generic
error + retry.

## RBAC (UX only — never the boundary)
- `middleware.ts` = presence check on `gs_session` → redirect. Real gate is the backend.
- `can("module:action")` helper derived from the current user's `permissions`; hide/disable
  controls the user lacks. The server still enforces every call.

## Design system (wireframe appendix)
Tokens: dark `#0f1724` · primary `#4f8ef7` · accent `#8b5cf6` · success `#1aab5f` ·
warning `#f59e0b` · danger `#e03b3b` · page bg `#f4f6f9` · border `#e8edf5`.
Type: H1 24/bold, H2 18/bold, H3 13/semibold, body 11, labels 9 uppercase.
Build the shared table / status-badge / form-field / modal-drawer / toast components **once** and
reuse across all module route groups. Responsive down to **375px** (PWA patterns; no separate app).
Semantic HTML + keyboard access.

## API client (`lib/api.ts`)
Same-origin `/api/v1/*` (Next rewrite → backend), `credentials: "include"`, adds `X-CSRF-Token`
(= `gs_csrf` cookie) on unsafe methods. One typed client file per module. No `any` — response
types mirror the contract in `types/`.

## Quality
`npm run lint` (`next/core-web-vitals` + `next/typescript`) · `npm run typecheck` ·
`npm run format`. Jest/RTL for component tests; Playwright for the critical E2E journeys.

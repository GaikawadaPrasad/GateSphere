# AGENTS.md — GateSphere Engineering Standards

**Every agent (human or AI) working in this repository MUST read this document in full before
writing code.** Treat GateSphere as a **production, critical enterprise application** — not a
prototype, not a CRUD demo. It manages physical community security, financial billing records,
statutory compliance data, and live gate traffic.

This file is the canonical rulebook; `backend/AGENTS.md` and `frontend/AGENTS.md` add platform
detail but never contradict it. The detailed appendices are `docs/platform/*`,
`docs/database/schema.md`, and `docs/security/*` — read them for the *why* behind a rule, not to
find a different rule. If code and this document disagree, that is a **bug to report**, not a
signal to follow the code. If this file and a `docs/` appendix disagree, the more detailed doc
wins for that area and this file must be corrected.

Distilled from the binding project documents: **PRD** (scope, RBAC matrix, acceptance), **SRS**
(FR‑01…FR‑19, NFRs), **TRD** (binding technical design), **DB ERD v1.2** (approved schema),
**Wireframes** (screens, routes, design system), **Plan of Action / 13‑Day Plan**. Source
documents outrank this file.

---

## 0. Project context (read once)

| Fact | Value |
|------|-------|
| Product | Residential community, visitor, security & facility management platform (MyGate‑category, original build) |
| Codename | GateSphere Enterprise — **GSE‑2026** |
| Vendor / QA | VPD Technologies (build) · Sivion Global Technologies (independent QA — external, authoritative) |
| Delivery | **30 calendar days** contractual ceiling; 13 working‑day internal sprint target. Both apply. |
| Frontend | **Next.js** (App Router, React 18+, **TypeScript strict**) |
| Backend | **FastAPI** (Python 3.12, async), **SQLAlchemy 2.0** + **Alembic** |
| Database | **PostgreSQL 15+** (Supabase in staging), single physical DB, logical multi‑tenancy by `community_id` |
| Auth | **Server‑side session cookies** (Secure + HttpOnly + SameSite, CSRF) — **no browser JWT** |
| Object storage | S3‑compatible — MinIO local / Supabase S3 staging |
| Async / jobs | Celery + Redis broker |
| Email | Brevo (transactional); SMS + WhatsApp are **mocked** (recorded, not sent); payments **simulated** |
| API style | RESTful JSON, versioned `/api/v1`, OpenAPI/Swagger always on in dev + staging |
| Performance | Security Gate Operations endpoints + dashboards target **sub‑second** under normal load (NFR‑PERF‑01). Claims must be **measured**, never asserted from a guess. |

### The 19 functional modules (FR‑01…FR‑19)

`auth` (01) · `users`/RBAC (02) · `communities` (03) · `visitors` (04) · `gate` (05) ·
`domestic_staff` (06) · `deliveries` (07) · `vehicles` (08) · `billing` (09) · `complaints` (10) ·
`amenities` (11) · `communication` (12) · `incidents` (13) · `dashboards` (14) ·
`notifications` (15) · `audit` + search/reporting (16) · seed data (17) · tech/security (18) ·
weekly Task View / Sivion QA (19). `residents` is split out of FR‑03 as its own module.

**Only build what GateSphere needs** — the module list above is the scope. Don't add
MyGate/competitor features the PRD/SRS doesn't require.

### The 10 roles (exact — no more, no less)

`super_admin` · `community_admin` · `association_committee` · `facility_manager` ·
`security_supervisor` · `security_guard` · `resident` (Owner/Tenant) · `domestic_staff` ·
`vendor_technician` · `auditor`. Fixed DB enumeration, never free text. Full matrix:
[`docs/security/roles-permissions.md`](docs/security/roles-permissions.md).

### Explicitly OUT of scope (do not build)

Live payment gateway (payments **simulated**), a specific SMS/WhatsApp provider, biometric
attendance, facial recognition, GPS tracking, external police‑verification APIs.

---

## 1. Golden rules

1. Every module has a **single clear responsibility**; modules map 1:1 to FR numbers for Sivion traceability.
2. Follow the **existing architecture and layering** — never invent a parallel pattern. A pattern
   already used throughout the codebase *is* the standard, even if another is arguably nicer.
3. **Validate all input at the edge** (fail fast). Never trust the client.
4. **Handle errors explicitly** — never swallow an exception. Never let a raw exception, SQL
   error, or stack trace reach a client response.
5. **Tests** for every service rule and every endpoint (incl. 401/403 and cross‑tenant 404).
6. **Update the relevant docs + session notes in the same PR** as behaviour‑changing code (§18).
7. **DRY** — no duplicated business logic; extract shared services / hooks / components.
   Deliberate duplication must say why in a comment at the point of duplication.
8. **KISS** — the simplest design that correctly satisfies the *actual* requirement. No
   abstraction for a hypothetical future one.
9. **SOLID + Separation of Concerns** — UI, business logic, data access, validation, infra stay separate.
10. **Never bypass authorization or tenant scope.** Enforcement is server‑side, always.
11. **Secure by Default** — least privilege, secrets from config, OWASP basics on every endpoint (§13).
12. **Single Source of Truth** — the backend/DB is authoritative; a derived/notification record never is.
13. **Maintainability over cleverness** — code is read far more than written. Prefer the boring, obvious implementation.
14. **Dependency discipline** — don't add a library for a few lines of code. Check existing code
    first, then maintenance status, security history, size, and license. Every dependency is a
    security surface and an upgrade obligation.
15. Leave code cleaner than you found it — but **no unrelated rewrites** and no restyling of
    working code.
16. VPD "done" ≠ task closed. Sivion validates and accepts. Build for independent testability.

## 1a. Priority order when fixing issues

When several things need fixing and effort is finite, work in this order — do not reorder for convenience:

1. Security 2. Data integrity 3. Authorization 4. Production‑breaking bugs 5. Correctness
6. Performance 7. Testing gaps 8. Observability 9. Maintainability 10. UX polish

A maintainability cleanup never jumps ahead of a security or data‑integrity finding because it is easier.

---

## 2. Architecture & layering

### Backend layers (never skip one — a route importing a repository, or a repository committing a transaction, is a layering violation, not a shortcut)

```
FastAPI router  →  service  →  repository  →  SQLAlchemy model  →  PostgreSQL
   (HTTP I/O)      (rules)     (queries)        (schema)
```

- **Router** — HTTP boundary only: resolve auth + permission dependency, validate the Pydantic
  request schema, bind tenant scope, call **one** service method, serialize the response. No
  `db.query` in a router. No business logic.
- **Service** — all business rules: state‑machine transitions, invariants, SLA timers, booking
  conflict resolution, delivery‑protocol routing, invoice generation, transaction orchestration,
  event emission (audit + notification). Framework‑agnostic; must not import `fastapi`, `Request`,
  or an ORM class; receives repository interfaces so tests can substitute in‑memory fakes.
- **Repository** — SQLAlchemy queries only. Always filters tenant tables by `community_id`.
  `selectinload`/`joinedload` sparingly, only for small bounded results. No business rules.
- **Model** — ORM table definition. Encodes invariants as DB constraints too.

Cross‑cutting concerns (session/CSRF, `require_permission`, tenant scope, audit, notifications,
rate limiting, correlation‑id logging) are FastAPI **dependencies / middleware** applied
uniformly — never re‑implemented per router.

### Backend module layout — `backend/app/modules/<name>/`

```
__init__.py  router.py  schemas.py  service.py  repository.py  models.py  tasks.py  tests/
```

Register a module: include its router in `app/api/router.py`, import its models in
`app/db/base.py`, add permissions to `app/core/rbac.py`, extend `app/scripts/seed.py`, write
`docs/backend/modules/<name>/README.md` + `docs/backend/api/<name>.md`, update
`docs/database/schema.md` if the schema changed.

### Frontend layers

```
Server/Client Component  →  hook (TanStack Query / mutation)  →  lib/api client  →  /api/v1
```

Components never call `fetch` directly — always through `lib/api`.

### Request flow (representative — memorise this)

```
Browser → Next.js (middleware: session cookie present? else → /login)
        → FastAPI /api/v1/...
        → dependency chain: load session → user → role(s) → community membership
        → require_permission("<module>:<action>")   → 403 if not permitted
        → bind tenant scope (community_id IN :scope) → 404 if target outside scope
        → router → service (business rules, one DB transaction)
        → repository → parameterized query, scoped to community_id
        → response serialized via a *Read schema (never the ORM model)
        → on state change: audit_logs row written IN THE SAME TRANSACTION
        → on notify-worthy event: enqueue notification (Celery, AFTER commit)
        → frontend re-fetches / invalidates the affected query keys
```

---

## 3. Multi‑tenancy & RBAC (the two invariants that cannot be broken)

### Tenant isolation (FR‑02, NFR‑SEC‑08) — the single most important invariant

**A user must never reach another community's residents, visitors, staff, vehicles, invoices,
complaints, bookings, notices, incidents, audit logs, settings, or financial data.**

- `communities` is the tenant root: `communities → gates`, `communities → towers → floors → units`.
- **Every tenant‑scoped table carries `community_id`** (directly or via a composite tenant‑safe
  FK such as `(community_id, tower_id)`). No exceptions.
- Enforced in **four independent places**: column (`community_id NOT NULL`), request context
  (resolved from the session, never the payload), repository (the scope predicate is injected on
  every read and stamped on every write), and **PostgreSQL RLS** as an independent backstop in
  staging/production.
- Scope filters are applied **before query execution** in the data‑access layer — **never** filter
  already‑fetched cross‑tenant rows in application code.
- Never trust a client‑supplied `community_id` for authorization — derive it from the role grant.
- **Cross‑tenant access → `404`, never `403`.** A `403` confirms the resource exists somewhere,
  which is an enumeration oracle.
- Any cross‑community data exposure is a **Critical** defect and a release blocker.

### RBAC (FR‑02)

- Model: `users` — `user_communities` (membership) — `user_roles` (grant; `community_id` NULL =
  global) — `roles` — `role_permissions` — `permissions`. A user may hold different roles in
  different communities.
- Permission string: **`"<module>:<action>"`** (`visitors:approve`, `billing:export`). Actions:
  `view` `create` `update` `delete` `approve` `export` (+ module‑specific).
- **Route‑level gate**: `Depends(require_permission("<module>:<action>"))` — 403 before any
  handler logic. This is a **coarse** check; anything row‑specific ("can this user see *this*
  unit's ledger") is a **service‑layer** check.
- Evaluation is `(role permissions ∪ allow overrides) − deny overrides` — **deny always wins**.
  `super_admin` short‑circuits to `*`.
- **Highest‑stakes actions** (financial configuration, community deletion, role changes,
  ownership/primary‑occupant transfer) re‑read the membership/role row **live** rather than
  trusting a cached permission set — a few minutes of cache staleness is not acceptable there.
- **Permission caching**: resolved permission sets may be cached per `(community, user)` with a
  short TTL, keyed with a `permission_version`; any role/permission/membership change bumps that
  version, orphaning every cached set for the community in one write (no scan‑and‑delete).
- **Frontend RBAC is UX only** — hide/disable controls; the backend re‑checks every action.
- `auditor` ⇒ **GET‑only** across financial ledgers, audit logs, incident histories, user‑access
  reports (NFR‑COMP‑02) — no write route accepts the auditor role.
- `super_admin` can switch active community via a scope selector.

---

## 4. Backend — how to build it (FastAPI)

### 4.1 Async & performance

- All I/O‑bound endpoints are `async def` on the async engine. Gate endpoints (FR‑05) and
  dashboards (FR‑14) are latency‑critical (**sub‑second**): keep them lean; index `gate_events`
  on `(community_id, gate_id, occurred_at DESC)`.
- Run Uvicorn/Gunicorn with multiple workers behind a reverse proxy in prod (`api-prod` entrypoint).

### 4.2 Request / response schemas

- Every endpoint declares a **Pydantic request schema** and a **distinct `*Read` response
  schema**. **Never return an ORM model** — it over‑exposes fields and couples the wire format to
  the table.
- Per resource: `*Create` (only client‑settable fields — no server‑computed values like invoice
  number or rollups; no guarded transitions — a ticket `status` change goes through a dedicated
  permission‑checked endpoint, never a plain `PATCH`) / `*Update` (all fields optional, applied
  with `model_dump(exclude_unset=True)`) / `*Read` / `*Filter`.
- Write bodies set **`extra="forbid"`** (+ `str_strip_whitespace=True`) so an unknown field
  `422`s instead of being silently dropped — **this is the mass‑assignment guard**, not a
  separate allowlist.
- Use enums for fixed sets (visitor category, delivery protocol, incident severity, ticket status).
- Wide list filters (many fields, repeated id lists) are **POSTed as a body**, not query strings —
  they aren't bookmarkable and saved filters live server‑side. Each list endpoint declares its own
  filter schema and its own `sort` / `order` fields; there is no generic query‑builder.

### 4.3 Pagination

- **Never return an unbounded collection from any endpoint.**
- Default: offset pagination — `page`, `page_size` (default 20, **max 100**), `sort`, `order`;
  response carries `meta:{page, page_size, total}` (TRD §8.2). Reject `page > 10000`.
- For large/hot append‑only tables (`gate_events`, `audit_logs`, `notification_deliveries`) use
  **keyset/cursor** pagination (opaque cursor, `WHERE (created_at, id) < (...)`) and **omit
  `total`** — counting a tenant‑scoped table on every page is the most common cause of slow lists.

### 4.4 Errors

- Every error response goes through the **central exception handlers**, always stamped with the
  `request_id`, in the envelope `{error:{code,message,fields}}` (§6). Register handlers for the
  app's domain exception, `RequestValidationError`, Pydantic `ValidationError`, a response‑model
  mismatch (→ opaque `500`, never leaks the shape), `StarletteHTTPException` (404/405 remapped
  into the same envelope), `SQLAlchemyError` (a stale‑data / lost‑update error → `409`
  "reload and try again", not a `500`), and a catch‑all.
- **Never** let a raw exception, SQL error, stack trace, secret, or filesystem path reach a client.

### 4.5 Transactions, events, idempotency

- Multi‑write operations run in **one transaction** (the `get_db` dependency commits on success /
  rolls back on exception).
- Audit entries for administratively‑sensitive actions are written **synchronously in the same
  transaction** as the operation (NFR‑REL‑01).
- Notifications are enqueued **after commit** (Celery) — the originating record is the source of
  truth; the notification is a derived, replayable side‑effect (FR‑15).
- Money / state‑changing / retryable operations (simulated payment, invoice generation, webhook
  handlers, Celery tasks) must be **idempotent** — safe against duplicate execution; use a natural
  unique key (`payment_reference`, `invoice_number`) or an explicit idempotency key.

### 4.6 Concurrency safety (NFR‑REL‑02)

Amenity booking confirmation and parking‑slot allocation each run in a single transaction with
**row‑level locking** (`SELECT … FOR UPDATE`) **or** a DB `EXCLUDE`/partial‑unique constraint on
the slot + time range. Two overlapping reservations must never both succeed → the loser gets `409`
with conflict detail.

### 4.7 N+1 prevention

The repository layer prefers explicit bulk fetches resolved in Python over per‑row relationship
loading. **Before adding a query**: know the expected row count, check existing indexes, check the
join + filter shape, and run `EXPLAIN ANALYZE` for anything touching a large table (`gate_events`,
`audit_logs`, `visitor_entries`, `maintenance_invoices`). Do not touch a lazy relationship
attribute outside its session context — return explicit tuples/DTOs from the service instead.

### 4.8 Files & uploads (NFR‑SEC‑07)

Visitor photos, staff ID documents, work‑completion proofs, ticket/incident attachments →
object storage only, never the web root. Validate **content‑type (sniffed) + extension allow‑list
+ size** server‑side before storing. Never trust a client‑provided filename. Serve via
presigned/time‑limited URLs.

### 4.9 Quality gates (before every PR)

`ruff check .` (incl. `S` bandit rules) · `black --check .` · `mypy app` · `pytest`. Nothing
merges red. Do not disable a lint rule or type check to make CI pass — fix the cause, or document
a deliberate suppression at the point of suppression with the reason.

---

## 5. Frontend — how to build it (Next.js)

### 5.1 App Router structure (route groups)

```
app/
  (public)/      login, forgot-password, reset-password
  (protected)/   dashboard, communities, towers, floors, units, residents,
                 visitors, gate, deliveries, domestic-staff, vehicles, parking,
                 violations, billing, payments, complaints, amenities,
                 communications, notifications, incidents, reports, audit-logs, profile
  (unauthorized)/  the 403 / access-denied screen
components/  ui/ (design-system primitives)  +  <module>/ (composites)
features/    module feature bundles (queries.ts, mutations, types.ts, dialogs)
lib/         api client (one file per module), auth helpers, RBAC UI guards
hooks/       TanStack Query hooks, one group per module
store/       client-only global state (Zustand / Context)
types/       shared TS types (mirror the API contract)
middleware.ts  route-level auth redirect + coarse role gating (UX only)
```

Role landing routes: `super_admin → /admin/global`, `community_admin → /admin/community`,
`security_guard → /gate/live`, `resident → /resident/home`.

### 5.2 Rendering strategy

- Server Components render role‑appropriate shells, static chrome, and the **initial** dashboard
  fetch. Client Components handle interactive/stateful screens (forms, approval queues, live gate).
- **Security Gate dashboard (FR‑05)**: client‑heavy, **< 2s load**, live visitor/gate updates via
  short polling or SSE/WebSocket, no full‑page refresh on approve/deny.
- All create/update/delete go through client‑side calls so the UI reacts to success / error /
  conflict immediately.

### 5.3 State discipline (the single most important frontend rule)

| Kind of state | Owner |
|---------------|-------|
| **Server data** (visitors, invoices, bookings, …) | **TanStack Query.** Never duplicated into Zustand. |
| **UI state** (sidebar, active view, filter draft, modals) | **Zustand / Context.** Never fetched. |
| **Form state** | **React Hook Form + Zod resolver.** |
| **URL‑shareable state** (filters, grouping, sort, active tab) | **Search params**, so views are linkable/bookmarkable. |

- **Never** store session/security data in `localStorage` / `sessionStorage`.
- User/role/community context comes from `/api/v1/auth/me` via a top‑level auth context.
- Stable hierarchical query keys (`["visitors", communityId, filters]`) so a mutation can
  invalidate a whole prefix. Set `staleTime` intentionally per query (a live‑state guard query =
  `0`; a rarely‑changing lookup = minutes) — don't leave everything on the library default by accident.
- **Frontend community‑cache isolation is mandatory.** Run `queryClient.clear()` on **every
  identity‑changing mutation** (sign in, sign out, switch community) and in the global `401`
  handler. A query cache that survives a community switch is §3's tenant‑isolation failure,
  client‑side. Test this directly (seeded `QueryClient`, mocked mutation, assert cache empty) —
  and the adjacent cases: rapid double‑switch, a *failed* switch (cache + UI stay on the original
  community), sign‑out, sign‑in as a different user, session expiry, browser back/forward.

### 5.4 Query / mutation conventions

- **Every mutation invalidates exactly the queries it affects** — never a blanket
  `invalidateQueries()`, never leave a stale list on screen after a successful mutation.
- Optimistic updates only where consistency allows (`onMutate` snapshot → optimistic patch →
  `onError` restore → `onSettled` invalidate so the server wins). Most mutations are simpler:
  `onSuccess` → `setQueryData` for the detail + `invalidateQueries` for lists.
- **Prevent duplicate mutations with a `useRef(false)` guard, not `mutation.isPending`.**
  `isPending` is React state — two events in the same tick both read the pre‑update value and a
  double‑click gets through. Check the ref before `.mutate()`, reset it in `onSettled`; the
  `disabled`/`loading` prop bound to `isPending` is the visible half, the ref is the load‑bearing
  half. Apply it to shared confirm dialogs once, not at each call site.
- **Bulk operations must surface partial failure explicitly.** Bulk endpoints return
  `{requested, succeeded, failed, errors}`; the UI renders "12 of 15 updated" with the failed
  items visible whenever `failed > 0` — never collapse that into one success toast. Not optimistic;
  invalidate the affected keys once the request settles.
- **An attachment upload is an explicit state machine**, not a boolean: `idle → request upload URL
  → uploading (direct PUT to storage) → confirming → success`, each with its own failure state.
  **Never show success before the confirm call itself returns.** Guard the confirm against
  duplicates with a per‑attachment in‑flight ref.

### 5.5 UX states — required for every screen

`loading` · `skeleton` (where appropriate) · `empty` · `error` · `retry` · `success` · `disabled`
· `permission-denied` · `not-found` · responsive/mobile.

- **Loading, empty, and error are three distinct states — never collapsed into one.** A secondary
  query with no `isError` branch renders a blank list indistinguishable from a genuinely empty one.
- **A background refetch must never blank out data already on screen.** A query with cached data
  stays rendered while revalidating; only the *first* load for a key shows a skeleton. Use
  `placeholderData: (prev) => prev` for paginated/filtered views so a new page/filter doesn't flash empty.
- Skeletons match the eventual layout (`aria-busy`, `aria-live="polite"`, `sr-only` label) —
  never a bare spinner.
- **Empty state distinguishes "nothing exists yet" from "nothing matches your filters"** — they
  read very differently.
- **Permission‑denied is not a route** — it's the RBAC gate component hiding/disabling UI (§3).
  Every gated action still has a server‑side check behind it.
- **A genuinely missing entity calls `notFound()`** when the fetch error is a 404‑shaped API
  error — never for a network error (that stays on the generic error/retry path).
- `401` → redirect `/login` (preserve `next`). `403` → access‑denied, render **no** data.
  `409` → show conflict detail from `error.message`, block resubmit. `422` → field errors.
  `429` → cooldown timer. `5xx` → generic error + retry.
- **No artificial delays in production code**, ever — a slow‑network/skeleton test throttles at
  the test level, never with a `setTimeout` in the app.

### 5.6 Forms & validation

- **React Hook Form + Zod** for every form. The Zod schema mirrors backend constraints **only
  where cheap and it saves an obvious round trip** (a code's character pattern, min/max length) —
  not exhaustively. The server's `422` (with `error.fields`) is the source of truth — map field
  errors back onto the form.

### 5.7 Realtime (gate feed, approval prompts)

- One `WebSocket`/SSE per tab, multiplexed; short‑lived ticket per connection, never stored.
- Realtime is **an optimisation, never a dependency** — connection failures log at debug level,
  never a user‑facing error.
- Inbound events are routed by `type` to `invalidateQueries` against the matching key prefix —
  **the socket never writes event payloads directly into the query cache** (that would make the
  wire payload a second public schema). Unknown event types are ignored for forward compatibility.
- A realtime event must never duplicate a local mutation's own effect — the actor is excluded
  server‑side; a background refetch triggered by someone else's change marks the query stale
  without forcing a fetch while a local optimistic mutation for the same key is in flight.
- A `gate:<id>` / `incident:<id>` channel subscription requires the actual membership/permission
  the channel names, checked server‑side on **every** subscribe — a broad "view" permission must
  not become a firehose subscription.

### 5.8 UI libraries & design system (wireframe appendix)

- **Tailwind CSS** + **shadcn/ui**. **Recharts** for charts. **TanStack Table** for data tables.
  Build the shared table / status‑badge / form‑field / modal‑drawer / toast components **once** in
  `components/ui/` and reuse across every module route group; a pattern used more than once becomes
  a `components/ui/` primitive or `components/patterns/` composite, never copy‑paste.
- Responsive down to **375px** (PWA patterns, no separate mobile app). Desktop for admin;
  tablet/kiosk‑friendly for the guard gate screen.
- Accessibility: semantic HTML, labelled controls, keyboard paths, `:focus-visible`,
  `prefers-reduced-motion`. Check any new/changed colour token against WCAG AA contrast (4.5:1
  text, 3:1 non‑text) before merging, in both light and dark — don't eyeball it.

**Design tokens**

| Token | Hex | Use |
|-------|-----|-----|
| Dark bg / sidebar | `#0f1724` | app chrome |
| Primary blue / CTA | `#4f8ef7` | primary actions |
| Accent purple | `#8b5cf6` | screen labels |
| Success green | `#1aab5f` | active / approved / paid / present |
| Warning amber | `#f59e0b` | pending / in‑progress / warning |
| Danger red | `#e03b3b` | alerts / overdue / rejected |
| Page bg | `#f4f6f9` | page background |
| Border | `#e8edf5` | borders / dividers |

Type: H1 24/bold (page), H2 18/bold (screen), H3 13/semibold (card), body 11 (tables), labels 9
uppercase. Status‑badge families: Active·Approved·Paid·Present / Pending·InProgress·Warning /
Rejected·Overdue·Absent / Info·AtGate·Assigned / Pre‑approved·Special / Closed·Exited·Inactive.

### 5.9 API client / same‑origin proxy

`frontend/lib/api.ts`: same‑origin `/api/v1/*` (Next rewrite → backend), `credentials: "include"`,
adds `X-CSRF-Token` (= `gs_csrf` cookie) on unsafe methods. One typed client file per module.
No `any` — response types mirror the contract in `types/`. Don't add a second way for client code
to reach the backend.

### 5.10 Frontend quality gates

`npm run lint` (`next/core-web-vitals` + `next/typescript`) · `npm run typecheck` ·
`npm run format`. Jest/RTL for components; Playwright for critical E2E journeys.

---

## 6. API design standards & the response contract

Full contract: [`docs/platform/api-contract.md`](docs/platform/api-contract.md).

- Versioned under **`/api/v1/...`**. Breaking change ⇒ `/api/v2` — never silently break `/v1`.
- Resource‑oriented REST: plural collection nouns; nested only for strict ownership
  (`/units/{unit_id}/residents`).
- Verbs: `GET` read · `POST` create · `PATCH` partial update · `PUT` full replace (rare) ·
  `DELETE` = **soft‑delete** where audit/history matters (residents, staff), hard‑delete otherwise.

### Response envelope (canonical)

**Every** response — success or error — has the shape `{ success, message, data, meta }`.

```jsonc
// success — single
{ "success": true, "message": "OK", "data": { ... }, "meta": null }
// success — list
{ "success": true, "message": "OK", "data": [ ... ],
  "meta": { "page": 1, "page_size": 20, "total": 137 } }
// error
{ "success": false, "message": "Slot already booked", "data": null,
  "error": { "code": "AMENITY_SLOT_CONFLICT",
             "fields": { "slot_id": "not available for 06:00–07:00" } } }
```

- Implemented: `app/core/responses.py` (`ok()`, `paginated()`, `Response[T]`, `PageResponse[T]`),
  `app/core/errors.py` (`AppError` hierarchy + central handlers), `frontend/lib/api.ts` (unwraps
  to `data`, throws `ApiError` with `code` + `fields`).
- `error.fields` is populated for `400`/`422`. `error.code` is a stable machine string documented
  per module. `message` is safe for display — never a stack trace, SQL, internal path, or another
  tenant's data.
- Routers return `ok(...)` / `paginated(...)` — never a raw ORM model.

### HTTP status mapping

| 200/201 ok / created | 204 ok, no body | 400 malformed | 401 not authenticated |
| 403 authenticated, not authorized | **404 not found OR outside tenant scope (never distinguished)** |
| 409 conflict (booking/parking) | 422 schema‑valid but business‑rule‑invalid |
| 429 rate limit on a sensitive endpoint | 500 unhandled (logged, generic message) |

### API‑layer security controls (uniform)

CSRF on cookie‑authenticated state‑changing requests · CORS locked to the known Next.js origin(s)
per environment · rate limiting (`slowapi`) on `/auth/login`, OTP/PIN verify, payment‑simulation ·
server‑side upload validation · role + tenant filter applied **before** query. Every endpoint has
an accurate OpenAPI `summary` and a `docs/backend/api/<module>.md` entry.

---

## 7. Authentication & session management (FR‑01)

**Model: server‑side session cookies. No JWT in the browser.** Full detail:
[`docs/platform/authentication.md`](docs/platform/authentication.md).

- **Login** `POST /api/v1/auth/login` — verify against the **Argon2** hash, check `is_active`,
  create a session, set cookies. Uniform `401 "Invalid email or password"` (no user enumeration).
- **Cookies**: `gs_session` (opaque token, **HttpOnly**, `SameSite=Lax`, `Secure` in
  staging/prod, `Path=/`) and `gs_csrf` (random, JS‑readable, same flags minus HttpOnly). Every
  unsafe method must send `X-CSRF-Token` = `gs_csrf` cookie.
- **Durable store**: the **`user_sessions`** table (ERD §01) — `session_key_hash`, `user_id`,
  `ip_address`, `user_agent`, `created_at`, `expires_at`, `revoked_at`. Redis MAY cache‑accelerate
  lookups but is **not** the system of record. Presenting a `revoked_at` session key is treated as
  a compromise signal — reject and log.
  > Scaffold currently stores sessions in Redis only — add the `user_sessions` table and write through.
- **Lifecycle**: idle TTL ~8h. **Revoke on**: logout, password change, role change, admin‑forced
  termination. `switch_community` re‑scopes without ending the session.
- **Rate limiting**: `/auth/login` and OTP/PIN verify per IP/account (default `5/minute`; 5 failed
  attempts → temporary lockout).
- **OTP (mobile)**: guards + residents may authenticate via OTP to the registered mobile (mock
  delivery — recorded, not sent). Same session issuance on success.
- **CSRF** is only relevant for cookie‑authenticated requests — safe methods, `/webhooks`,
  `/healthz`, `/readyz` are exempt.
- **Audit**: every login success/failure and logout writes an `audit_logs` row.
- Frontend `middleware.ts` redirects unauthenticated users to `/login?next=...` (presence check
  only); the backend re‑validates every request.

---

## 8. Database — schema best practices

Approved reference: **DB ERD v1.2**. Full table catalogue with per‑table constraints:
[`docs/database/schema.md`](docs/database/schema.md).

### 8.1 Identity, keys, columns

- **PK**: `id` = **UUID v4**, generated in the app layer (`app/db/base_class.py::pk`). This is a
  deliberate deviation from ERD v1.2's BIGINT identity, recorded in
  [ADR‑009](docs/decisions/ADR-009-identifiers.md) — sequential ids are enumerable in a security
  product. Every other detail in the ERD still holds. Use `pk()` / `fk()` / `TenantMixin` from
  `base_class.py`; never invent a per‑model id type.
- **FK**: `<entity>_id`, always with an explicit `ON DELETE` (default `NO ACTION` turns an
  ordinary delete into a constraint violation at an unrelated call site months later). Composite
  **tenant‑safe FKs** where a child must stay in its parent's community.
- Every tenant table: `community_id BIGINT NOT NULL` + index.
- Mutable tables: `created_at`, `updated_at` (`TIMESTAMPTZ`) + `created_by` where an actor exists.
  Append‑only tables keep only `created_at`/`occurred_at`.
- All timestamps `TIMESTAMPTZ`. Money `NUMERIC(12,2)` (never float). Enumerations `VARCHAR` +
  `CHECK`, not free text.

### 8.2 Integrity — enforce in the DB, not only in code (FR‑18, NFR‑SEC‑03)

- All FKs enforced by PostgreSQL constraints. Use DB constraints wherever correctness requires
  them; do not rely on application‑only uniqueness or referential integrity for anything that matters.
- Encode business invariants as `CHECK` / `UNIQUE` / `EXCLUDE` (see `schema.md` for the full list
  per module — role scope, `valid_from < valid_to`, `exit_at >= entry_at`, one active parking
  allocation per slot, overlapping‑booking exclusion, `sum(payment_allocations) <= amount`, …).
- For soft‑deleted rows, use a **partial unique index** (`… WHERE deleted_at IS NULL`) rather than
  a plain `UniqueConstraint`, so a deleted record doesn't block name reuse.
- **Append‑only tables** (`audit_logs`, `gate_events`, `delivery_events`, `ticket_status_history`,
  `incident_status_history`, `incident_actions`, `notification_deliveries`): `INSERT` only from
  app code; add a DB trigger / `REVOKE UPDATE, DELETE` / RLS in staging to enforce it.
- Posted invoices/payments/ledger rows are **immutable** — corrections via controlled
  reversal/adjustment entries, never edits. `ledger_entries` is derived/append‑only; recompute
  `balance_after` transactionally on each posting.

### 8.3 Config‑as‑data (not hardcoded)

`visitor_policies`, `parking_rules`, `billing_rules`, `amenity_rules`, `delivery_protocols`,
`sla_policies` are the **DB source of truth** for their rules — one active row per community.
Never hardcode protocol / SLA / booking / billing rules in backend or frontend.

### 8.4 Migrations (NFR‑MAINT‑01)

- **Alembic is the only sanctioned schema‑change mechanism** in any environment beyond bare local.
  Never hand‑edit a deployed schema (Supabase included). The backend keeps **one** migration
  history for the shared DB.
- `make revision m="…"` autogenerates — then **read what it produced before trusting it**
  (types, server defaults, indexes, `ON DELETE`, data migrations). Provide a real `downgrade()`.
- Run the migration **and its downgrade** locally. CI runs `alembic upgrade head`, then a
  downgrade/re‑upgrade round‑trip, plus a model‑vs‑migration drift check — all gating.
- Every hot index leads with `community_id`. Trigram/tsvector indexes use `postgresql_ops` on a
  plain column, never a `text()` expression (Alembic can't diff expression indexes → silent drift).
- **Migrations run as a separate one‑shot deployment job, never on app start** — N replicas
  rolling out simultaneously would otherwise race applying the same migration.
- Destructive changes ship with a rollback plan and require DB/backend approval + backup
  confirmation. Update `docs/database/schema.md` in the same PR.

### 8.5 Performance

Index `community_id` + every FK + the primary filter/sort columns of each module (`status`, date
ranges). No N+1. Paginate everything. Use partial indexes (`WHERE deleted_at IS NULL`) for
live‑row scopes.

---

## 9. Cache / Redis, rate limiting & background jobs

### 9.1 Cache / Redis discipline

- **Every Redis operation is failure‑tolerant by design** — a read misses and a write drops
  silently on a Redis error; a cache outage degrades performance, it never takes down
  availability. Any new cache must keep that property.
- **Every cached value must be reconstructible from PostgreSQL** — Redis is never the source of
  truth for anything that matters.
- Namespaced, tenant‑prefixed keys built through one helper — don't hand‑format a Redis key.
- Never `KEYS *` — use `SCAN`, batched. Before adding a cache, define (in this order): key format,
  TTL, invalidation trigger, behaviour on a miss, behaviour on a Redis outage. Only cache where
  there's a measured reason.

### 9.2 Rate limiting

Sliding‑window over Redis; identity is `user:{id}` when resolvable, else `ip:{addr}`. Buckets by
path class (`auth`, `search`, `upload`, `export`, `write`, `default`). **Fails open** on a Redis
error — availability over strictness. A reverse proxy adds a second, independent rate‑limit layer.

### 9.3 Background jobs (Celery)

- Separate queues (`default`, `email`, `notifications`, `reports`, `maintenance`) so a bulk import
  producing thousands of notifications cannot delay a password‑reset email.
- **Idempotency by stamping, not dedup logic** — mark the row once the effect has happened (a
  notification row marked dispatched, an invoice marked generated) so a concurrent or late sweep
  skips it. Make the *effect* checkable; don't rely on the scheduler never firing twice.
- **Retries**: `autoretry_for` is a narrow allow‑list of **transient** errors only (DB
  `OperationalError`, Redis connection/timeout, `ConnectionError`/`TimeoutError`/`OSError`).
  Validation and business‑rule failures fail once, loudly. Exponential backoff with jitter.
  **Never** add a broad `except Exception: retry` — that turns a bug into an infinite retry loop.
- Long‑running work (email, notification dispatch, report generation, imports, file processing,
  monthly invoice run, SLA escalation sweep, due‑date reminders) belongs in a worker, never inline
  in a request handler. Beat ticks set `expires` so a late tick is skipped rather than duplicating.

---

## 10. Module business rules & state machines (enforce in the service layer)

| Module | Non‑negotiable rules |
|--------|----------------------|
| **visitors** (FR‑04) | Categories: personal guest, relative, cab/taxi, delivery exec, service tech, vendor, interviewee, event guest, recurring. Flow: guard logs → **blacklist check first** → pre‑approved? (QR/OTP → direct entry) else resident approval prompt → approve/reject (reason logged) → entry timestamp → exit timestamp → permanent audit. Multi‑visitor grouping under one approval. Mandatory photo + vehicle number where applicable. Approval prompt: secondary notification at 2 min, guard timeout status at 5 min. Pass states `ISSUED→ACTIVE→USED→EXPIRED|REVOKED|CANCELLED`; rejected/expired/revoked cannot produce an entry. |
| **gate** (FR‑05) | Low‑latency. `gate_events` append‑only, `event_type` controlled ENUM. Blacklisted entries intercepted **before** a normal gate transaction is recorded. Panic alert = one‑tap broadcast to Security Supervisor + Community Admin with location + timestamp; ack requires `acknowledged_by` + `acknowledged_at` together. Guard roster/assignment intervals must not overlap where the rule forbids. |
| **domestic_staff** (FR‑06) | Multi‑apartment assignment (many‑to‑many `staff_unit_assignments`), attendance stamped from gate check‑in per unit, `check_out_at >= check_in_at`, at most one open attendance row per staff. Ratings retained in history. Police‑verification status tracked. All staff/unit/gate links resolve to the same community. |
| **deliveries** (FR‑07) | Categories: food, grocery, e‑commerce, courier, pharmacy. Protocols from `delivery_protocols` (per community/unit): **Allow at Gate · Resident Approval Required · Leave at Gate Desk · Direct Rejection**. Protocol lookup drives routing **before** the `gate_event` is created. `delivery_events` append‑only; every parcel fully audited. |
| **vehicles** (FR‑08) | Resident + visitor vehicles (car/bike/service). One active allocation per slot (unless multi‑slot enabled). Automated plate logging on gate entry/exit, auto‑match to registered vehicles, flag unknown plates. Unauthorized parking → `parking_violations`. |
| **billing** (FR‑09) | Monthly invoices per flat‑wise `charge_heads`; special assessments, penalties, late fees, discounts, advances. **Payment is SIMULATED** — `/maintenance-invoices/{id}/pay` marks paid, generates a receipt, updates the ledger **in one transaction**, no external gateway. Real‑time outstanding + resident ledger. Posted records immutable. |
| **complaints** (FR‑10) | Categories: plumbing, electrical, housekeeping, lifts, security, common areas. Lifecycle **`Created → Assigned → Acknowledged → In Progress → Resolved → Resident Confirmation → Closed`** — transitions validated; **cannot reach `Closed` without resident confirmation**. Priority + SLA timers from `sla_policies`; escalation on at‑risk/breach → notify Facility Manager + Community Admin; overdue shows red on all dashboards. `ticket_status_history` append‑only. One `ticket_feedback` per ticket. Assignment = internal assignee **XOR** vendor. |
| **amenities** (FR‑11) | Clubhouse, gym, pool, tennis, community hall, guest rooms. Slot + capacity + rules from `amenity_rules`. Maintenance blocks make a slot unbookable. **Atomic conflict check** on confirm (row lock or `EXCLUDE`); overlap → `409` with detail. Advance‑booking window enforced. Booking's unit/resident/amenity all in one community. |
| **communication** (FR‑12) | Notices, emergency alerts, polls, surveys, events. Target = specific towers / blocks / resident groups / whole community (`announcement_targets`). **Validate the initiator is authorized to broadcast to the selected scope before publish.** Published broadcasts are a permanent record. One poll response per user unless repeat voting is explicitly enabled. |
| **incidents** (FR‑13) | Types: medical, fire, theft, suspicious visitor, security breach, lift entrapment. Record severity + location + reporter at creation. Assign security personnel. `incident_actions` append‑only; full resolution audit trail. May trigger an emergency broadcast/notification. `incident_status_history` records every `old→new` transition. |
| **dashboards** (FR‑14) | Super Admin (cross‑community) · Community Admin (community KPIs, financial health, staff attendance, incidents) · Security (live gate traffic, pending approvals, expected visitors, alerts) · Resident (visitors, approvals, dues, tickets, notices). **Every dashboard query is scoped by the viewer's role + community before aggregation.** |
| **audit / search / reports** (FR‑16) | `audit_logs`: immutable insert‑only — `community_id`, `user_id`, `session_id`, `action`, `module`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`. Search/filter/report results have role + community scope applied **before** query execution. Auditor endpoints GET‑only. |

### Audit logging — what MUST produce an audit record

Login/security events · member/role added, removed, changed · permission changes · resident
profile create/update/delete · community/tower/unit settings changes · visitor approve/reject ·
blacklist changes · gate checkpoint override · panic alert · invoice generation · payment
recorded · ledger adjustments · ticket status changes · incident create/assign/resolve · broadcast
published · notification‑channel config changes · any destructive operation. There is **no**
"edit audit log" code path and none should be added.

---

## 11. Seed data (FR‑17) — empty screens are a defect

A **deterministic, idempotent** Python seed script (`app/scripts/seed.py`, re‑runnable against a
clean DB, version‑controlled beside the migrations) populates every environment beyond bare local
with **at least**: 2 communities · 4 towers · 8 floors · 50+ operational units · full
distributions of owners/tenants/family members/security staff/domestic staff/visitors/vehicles/
parking slots · active maintenance invoices + payments · service complaints across all categories
· amenity bookings · notices · security incidents with full lifecycle · a populated audit trail
reflecting all of the above. Any empty screen in the delivered system is a Sivion defect. A new
module extends the seed in the same PR.

---

## 12. Quality, tooling & the Sivion QA lifecycle

### Tooling

| Tool | Role |
|------|------|
| **Black** | Python formatter — consistency |
| **Ruff** | Python linter + import sort + bandit (`S`) security rules |
| **mypy** | Python type checking |
| **ESLint** (`next/*`) + **Prettier** | TypeScript lint + format |
| **pytest** | backend unit + integration tests (real Postgres + Redis in CI, no DB mocking) |
| **Jest / React Testing Library** | frontend unit/component |
| **Playwright** (or Cypress) | E2E for critical journeys |
| **SonarQube** | SAST + code quality/maintainability (bugs, vulns, code smells) |
| **OWASP ZAP** | DAST against the running app before release |
| **gitleaks** | secret scanning (pre‑commit + CI) |
| **STIX** | structured format for any cyber‑threat‑intelligence exchange in the threat model |

Design principles enforced in review: **DRY**, **KISS**, SOLID, Separation of Concerns, Single
Source of Truth, Fail Fast, Secure by Default, Explicit over Implicit, Strong Typing, Consistent
API Contracts, Database Integrity First, Concurrency Safety, Idempotency, Cache Correctness,
Observability, Testability, Maintainability over cleverness.

### Testing discipline

- **Backend**: `backend/tests/unit/` (service rules, permission evaluation, workflow transitions,
  validators) and `backend/tests/integration/` (API + real Postgres + real Redis, tenant
  isolation, auth, RBAC — including 401/403 and **cross‑tenant 404** cases). A dedicated
  cross‑tenant isolation suite exists; **any new tenant‑owned table or repository method needs a
  case added there.** Treat CI's actual pass count as authoritative — never propagate a stale
  count from a doc.
- **RLS blind spot** — the ordinary backend suite connects as a privileged DB user (superuser
  → bypasses RLS), so **a green backend suite is not evidence that tenant isolation works at
  the DB layer.** `backend/tests/test_tenant_isolation.py` closes this: it creates a
  `gs_rls_test` role (`NOSUPERUSER NOBYPASSRLS`), connects as it, and asserts the
  `tenant_isolation` policy filters reads and blocks cross-scope writes across every tenant
  table. `alembic check` does not close this gap (autogenerate can't see policies).
- **Frontend**: Vitest/Jest + Testing Library for units; Playwright for E2E (login, visitor
  approval, gate entry, amenity booking conflict, invoice payment, complaint lifecycle, tenant
  isolation, responsive, slow‑network).
- **Tests must be deterministic** — no dependency on execution order or a previous test's leftover
  mutation. A mutating test cleans up its own state in a `try/finally` around the assertion that
  can fail (a cleanup call *after* a failing assertion never runs, and the next run inherits the
  leftover as if it were fixture state).
- **No silently skipped critical path** — zero `test.skip`/`.only` on a critical journey; a
  missing expected element is a failure, not a `.count() === 0` conditional bail that asserts
  nothing. A test that can't pass stays red and documented as a known defect, never silenced.
- **A feature is not complete because the UI renders.** Every meaningful module needs unit tests,
  integration tests where it touches the DB or an external boundary, and E2E for a genuinely new
  critical workflow. A test that doesn't exercise the actual failure mode it claims to cover is
  **worse than no test** — it's false confidence that survives review.
- **A production‑shaped performance claim requires a production‑shaped measurement.** If the
  environment can't produce one, report the dev number labelled as exactly that and mark the
  production figure **UNVERIFIED** — never present a dev P95 as if it answered the target.

### Sivion independent QA lifecycle (FR‑19) — a task is not closed until it completes

```
Development → VPD Internal Testing → Task Submission → Sivion Testing
→ Defect Report → VPD Fix → Sivion Retest → Final Acceptance
```

VPD‑internal completion (including green automated tests) is **not** task closure.

### Defect classification

| Critical | security breach, data corruption, auth failure, business‑critical outage | **100% resolved before acceptance** |
| High | major functionality unavailable, no reasonable workaround | **100% resolved before acceptance** |
| Medium / Low | minor UI/usability | tracked, not release‑blocking |

### Final acceptance conditions

All FR‑03…FR‑16 modules operate end‑to‑end · synthetic seed data fully populated · RBAC
independently verified against the matrix (incl. cross‑tenant + URL‑manipulation) · repository
code inspected · Sivion testing + retesting complete with **zero unresolved Critical or High**
defects.

---

## 13. Security — OWASP Top 10 (review every feature against this before it is "done")

| Risk | Control in GateSphere |
|------|-----------------------|
| Broken Access Control | tenant‑scoped repository + RLS backstop + `require_permission` + service‑layer row checks + cross‑tenant isolation test suite (§3, §12) |
| Cryptographic Failures | **Argon2** password hashing; hashed session keys, OTP hashes, ID‑number hashes; no plaintext or reversible storage of secrets |
| Injection | parameterised SQLAlchemy only — **no string‑built SQL, ever** |
| Insecure Design | deny‑wins permission evaluation, **404‑not‑403** tenant isolation, session revoke‑on‑change, config‑as‑data rules |
| Security Misconfiguration | security headers set in Next.js **and** the reverse proxy (deliberately redundant); strict CORS per env; `.env` gitignored; fail‑fast config validation |
| Vulnerable/Outdated Components | dependency + secret scanning in CI; a written decision for every finding — "deferred, here's why" is acceptable, silence is not |
| Auth Failures | server‑side sessions with revocation, Argon2, rate‑limited `/auth/login` + OTP, uniform login error |
| Software/Data Integrity Failures | Alembic migrations gated by a drift check in CI; append‑only audit/event tables; immutable posted financial rows |
| Logging/Monitoring Failures | structured JSON logs with `request_id` + `community_id` + `user_id`; append‑only `audit_logs` for security‑relevant actions |
| Exceptional Conditions | central exception handlers (§4.4) — never leak SQL errors, stack traces, secrets, or filesystem paths |

Also explicitly check on every feature: **SSRF, CSRF, XSS** (React escaping + server‑side
sanitisation of any HTML‑rendering field + strict CSP), **SQL injection, command injection, path
traversal, insecure file uploads** (size + MIME + extension + authorization + storage path; never
trust a client filename), **rate‑limit bypass, privilege escalation, IDOR/BOLA, mass assignment**
(`extra="forbid"` — §4.2), **unsafe deserialization**.

---

## 14. Observability, config & environments

- **Structured JSON logs** (`structlog`) with a `request_id` on every request (middleware wired),
  plus `community_id` / `user_id` / `route` / `duration_ms` where available. Log at boundaries and
  on failure — not success spam. **Never log** passwords, tokens, session ids, auth cookies, or
  full PII.
- Health: `/healthz` (liveness — must never touch a dependency) and `/readyz` (checks DB + Redis,
  `503` on degraded). Don't make either check more expensive than it needs to be.
- **A stale reading is never presented as current** — a health/metric derived from a cache or a
  periodic collector is labelled (`healthy` / `stale` / `unknown`), and an expensive per‑request
  probe (e.g. a Celery broadcast ping) is moved to a scheduled collector + cache, not run inline.
- **Configuration over hardcoding** — every environment‑specific value (DB URL, secret key, cookie
  flags, CORS origins, TTLs, S3, Brevo) comes from validated settings (`app/core/config.py`); the
  app **fails fast on startup** if a required setting is missing or unsafe for `production`
  (no TLS, default credentials, wildcard hosts). Do not weaken or add an escape hatch to that gate.
- Environments: **local** (this repo's `docker compose`) · **staging** (Vercel · Render · Supabase
  Postgres + S3 · Upstash Redis · Brevo — [`docs/platform/deployment-staging.md`](docs/platform/deployment-staging.md))
  · **production** = the same images promoted after Sivion acceptance.
- Never commit `.env`; `.env.example` (root + `backend/` + `frontend/`) documents every key.
  Secrets rotated independently per environment. If a new local secrets file is added anywhere,
  gitignore it in the **same** commit.

---

## 15. Git / PR / evidence rules

- Branches: `feat/<module>-<short>`, `fix/<module>-<short>`, `chore/…`, `docs/…`, `security/…`.
- **Conventional Commits**: `feat(visitors): add QR pass validation`. Small, focused commits.
- **Never commit directly to `main`.** Never rewrite git history or delete branches without
  explicit approval from the repo owner.
- Two‑repo model (Plan of Action §8): the internal repo is the fast‑moving source of truth; stable,
  internally‑tested snapshots are promoted to the external submission repo with weekly tags
  (`W1`…`W4`) and full commit/PR/tag traceability. Never let code and the deployed schema drift.
- **Repository/source‑code access is mandatory project evidence** — a deployed URL alone is not
  sufficient. Keep commit history, PRs, and a working demo reference for every weekly submission.
- PR checklist: tests pass · lint/format/type‑check pass · migration included, reviewed, with a
  tested `downgrade()` · seed extended · docs + `schema.md` + session notes updated · RBAC
  verified · **cross‑community negative test** · no secrets · response envelope honoured · OpenAPI
  summary accurate · a security review against §13 for anything touching auth/permissions/tenant
  boundaries/user input.
- Weekly Task View row = module · task · assigned dev · planned start/end · actual status & % ·
  commit/PR/tag · demo evidence · internal testing status · bug count by severity · Sivion status.
  Verbal percentages are not acceptable.

---

## 16. Feature development lifecycle

```
Understand the requirement (against the PRD/SRS/TRD/ERD)
  → inspect existing architecture (this file + the docs it points to)
  → create feature branch
  → design the data / API / UI changes
  → implement backend: models → schemas → repositories → services → routes
  → implement the Alembic migration (§8) — write it, run it, run the downgrade
  → implement frontend (§5)
  → implement loading / error / empty / permission-denied / not-found states (§5.5)
  → add tests (§12): unit + integration + E2E where the workflow is genuinely new
  → run lint / type / security checks locally
  → run integration / E2E
  → validate performance for anything on a hot path — measured, not guessed
  → update docs + session notes (§18)
  → review the diff line by line
  → push branch → PR
```

---

## 17. Definition of Done / production-readiness gate

A feature is production‑ready — and may be called done — only when:

- Functionality, permissions, and validation **work — verified, not assumed**.
- Tenant isolation verified with a cross‑community negative test.
- Loading, error, empty, retry, disabled, permission‑denied, and not‑found states all exist (§5.5).
- Responsive behaviour + accessibility are acceptable (§5.8) — a11y issues found are fixed, not deferred silently.
- Tests exist at the layers that apply (§12) and **were actually run**.
- A security review against §13 was done for anything touching auth, permissions, tenant
  boundaries, or user input.
- Performance is **measured**, not guessed, for anything on a hot path.
- Logging and audit logging exist where §10/§14 require them.
- Seed data present so the screen is never empty (§11).
- Migration safety **and rollback** are understood — not just "it ran once".
- Docs (`docs/backend/modules/…`, API doc, `docs/database/schema.md` if schema changed) and
  session notes are updated.
- All CI gating jobs pass; report‑only findings have a **written decision**, not silence.
- The branch is pushed and the PR is **genuinely ready for review**, not a work‑in‑progress
  presented as finished.

---

## 18. Documentation & session continuity

- Update documentation for any change that alters architecture or behaviour — not every change,
  but any change a future reader would be surprised by. The `docs/` appendices are authoritative
  for their areas; keep them current rather than letting drift accumulate.
- Maintain **`docs/development/session-notes.md`**: record meaningful changes **as you go**, not
  retroactively from memory at the end, so the next session (human or AI) can continue without
  reconstructing context from `git log` alone.
- At the start of a new session: read the relevant session notes and current `git status` /
  `git log` before continuing. Do not assume previous session work is complete, and do not discard
  a previous architectural decision without reviewing why it was made.

---

## 19. Forbidden patterns

- Business logic in routers, components, middleware, or migrations.
- Returning ORM models from an endpoint; missing a response schema.
- Raw / string‑formatted SQL; any SQL built from user input.
- `Any` / `any` / unchecked casts without a justified inline reason.
- Catching and ignoring exceptions; bare `except:`. Broad `except Exception: retry` in a task.
- Reading/writing session or security data in `localStorage` / `sessionStorage`.
- Skipping the `community_id` filter on a tenant table, or filtering cross‑tenant rows in app code.
- Trusting a client‑supplied `community_id` or role for authorization.
- Returning `403` (instead of `404`) for a cross‑tenant object.
- Hardcoding protocol / SLA / booking / billing rules that belong in a `*_rules` / `*_policies` table.
- `UPDATE` / `DELETE` on an append‑only table (`audit_logs`, `gate_events`, `*_status_history`, …).
- Editing a deployed schema outside Alembic; running migrations on app start; hand‑editing
  generated files or lockfiles.
- `KEYS *` in Redis code or an ops script. A cache that becomes a source of truth.
- Duplicate mutations guarded only by `mutation.isPending` (no ref).
- A blank screen where a distinct loading / empty / error state belongs; a background refetch that
  blanks out data already on screen.
- New global mutable state; duplicated constants (use `core/constants.py` or add one).
- A real SMS/WhatsApp/payment‑gateway integration (out of scope — keep them mocked/simulated).
- Committing `.env`, credentials, or real resident/financial data.
- Adding a dependency for something small and safe to hand‑write.
- Disabling a lint rule / type check / security gate to make CI pass.
- Shipping a screen with no data (violates FR‑17).

---

## 20. What not to do

- **No unnecessary rewrites.** Fix the actual issue; don't refactor adjacent working code because
  it offends taste.
- **Don't change working architecture for stylistic preference.** A pattern already in use
  throughout the codebase is the standard, even if a different one is arguably nicer in isolation.
- **Don't optimise blindly.** Measure first (query plans, actual latency, actual load) before
  changing anything for performance. A change made on a guess is a regression risk with a
  performance‑shaped excuse.
- **Don't create superficial tests.** A test that doesn't exercise the failure mode it claims to
  cover is worse than no test.
- **Don't claim production readiness if important checks remain unverified.** State plainly what
  was actually run and what wasn't.
- **Don't implement a module or feature GateSphere hasn't asked for** merely because a competitor
  has it (§0).
- **Don't bypass permission checks for convenience**, disable a security or quality gate to make
  CI pass, or skip a migration's downgrade check because it's inconvenient this time.
- **Never commit directly to `main`.**

---

## 21. Required validation before every commit

```bash
make lint        # ruff + black + eslint + tsc
make test        # pytest (+ frontend tests once wired)
make migrate     # migrations apply cleanly on a fresh DB
```

A new module additionally requires: module README + API doc + (flow doc if it adds a business
flow) + permissions in `app/core/rbac.py` + `*_rules`/`*_policies` config rows where relevant +
extended `seed.py` + `docs/database/schema.md` updated + a `session-notes.md` entry + service‑layer
tests including the 401/403/404‑cross‑tenant cases.

---

## 22. Before declaring anything done — the four‑section report

Run, and report the **actual results** of, whichever apply: backend tests · frontend tests ·
integration · E2E · lint / type / build · security checks · migration validation (+ downgrade) ·
critical API paths and frontend workflows exercised for real · `git diff` inspected line by line.

Report in four sections:

- **Completed** — what was actually fixed and verified.
- **Not completed** — what remains, and why.
- **Risks** — known production risks, including ones the work didn't address (cross‑check §23 so an
  existing gap isn't re‑reported as new).
- **Next steps** — prioritised, using the ordering in §1a.

Silence on an area is not the same as "checked and fine" — say which one it is.

---

## 23. Known gaps (state plainly so they're tracked, not rediscovered)

### Done in the foundation upgrade (2026‑08‑27)

- ✅ **Identity** — UUID v4 repo‑wide, [ADR‑009](docs/decisions/ADR-009-identifiers.md).
- ✅ **Session store** — `user_sessions` table is the system of record (migration `0002`); Redis
  caches. Revoked on logout / password change / role change.
- ✅ **Response envelope** — `{success, message, data, meta}` + `{error}` via `app/core/responses.py`
  and `app/core/errors.py` (central handlers); `frontend/lib/api.ts` unwraps it.
- ✅ **Tenancy infra** — `app/core/tenancy.py` (`get_tenant_scope`, `TenantScope`, `tenant_context`,
  `bind_rls_scope`) + `app/db/repository.py` (`TenantRepository`). Module routers use these.
- ✅ **RLS** — migration `0003` enables Row‑Level Security + a GUC‑based policy on the tenant
  tables that exist today; `bind_rls_scope` sets `app.community_ids` per request.
- ✅ **Frontend structure** — `(public)` / `(protected)` route groups + `/unauthorized`,
  `lib/{api,query,permissions}`, `store/ui.ts` (Zustand), `hooks/use-auth.ts` with
  `queryClient.clear()` on every identity change, global 401 → `/login`, RHF+Zod login form,
  `package-lock.json` committed.
- ✅ **`docs/development/session-notes.md`** — created.

### Backend module build-out (one at a time, per the 13-day plan)

| FR | Module | Status |
|----|--------|--------|
| 01 | auth / session | ✅ sessions + RBAC + envelope + rate limit |
| 02 | users / RBAC | ✅ **implemented** — catalogue + `require_permission` + `TenantScope`, **management API** (`GET/POST /users`, `PATCH`, `POST /{id}/roles`, `DELETE /{id}/roles/{grant}`, `GET /users/roles`); scoped grants, session revoke on any RBAC change; README + API doc |
| 16 | audit | ✅ **implemented** — `audit_logs` (migration `0005`) + `record_audit()` helper + **query API** (`GET /audit/logs` w/ filters, `GET /audit/logs/{id}`, `GET /audit/logs.csv`); `audit:view` / `audit:export`, community-scoped; README + API doc |
| **03** | **communities & property** | ✅ **implemented** — models (composite tenant-safe FKs), `TenantRepository`, service (scope rules, enum/conflict checks), router (envelope + RBAC), migration `0004` (+ RLS on gates/towers/floors/units), seed, unit + integration tests, module README + API doc |
| 03 | residents | ✅ **implemented** — 5 tables (composite tenant-safe FKs, partial-unique primary occupant), move-record state machine, migration `0006` (+ RLS), seed, unit + integration tests, README + API doc |
| 04 | visitors | ✅ **implemented** — 7 tables (blacklist HMAC screening, host-approval workflow, QR/PIN/OTP passes, gate entry/exit), per-community policy, migration `0007` (+ RLS + audit-index rename), seed, unit + integration tests, README + API doc |
| 05 | gate | ✅ **implemented** — 4 tables (append-only `gate_events`, guard rosters, gate assignments, panic/SOS alerts), roster + alert state machines, one-active-assignment rule, migration `0008` (+ RLS), seed, unit + integration tests, README + API doc |
| 06 | domestic_staff | ✅ **implemented** — 4 tables (staff directory, multi-unit assignments w/ partial-unique active, gate attendance w/ single-open-row, resident ratings w/ upsert), migration `0009` (+ RLS), seed, unit + integration tests, README + API doc |
| 07 | deliveries | ✅ **implemented** — 3 tables (config-as-data `delivery_protocols`, `deliveries` approval+arrival workflow, append-only `delivery_events`), protocol-driven auto-approval, migration `0010` (+ RLS), seed, unit + integration tests, README + API doc |
| 08 | vehicles | ✅ **implemented** — 6 tables (vehicle registry w/ owner XOR CHECK, parking rules config-as-data, slots, allocations w/ partial-unique active, automated plate `vehicle_entries`, `parking_violations`), migration `0011` (+ RLS), seed, unit + integration tests, README + API doc |
| 09 | billing | ✅ **implemented** — 7 tables (charge heads, config-as-data `billing_rules`, `maintenance_invoices`+items, simulated `payments`+allocations, append-only `ledger_entries` w/ `Identity` sequence), server-computed totals + tax, post/pay state machine, migration `0012` (+ RLS), seed, unit + integration tests, README + API doc |
| 10 | complaints | ✅ **implemented** — 7 tables (categories, config-as-data `sla_policies`, `service_tickets` w/ SLA clocks, append-only `ticket_status_history`, assignments w/ executor XOR, messages, feedback), lifecycle state machine w/ mandatory resident confirmation, migration `0013` (+ RLS), seed, unit + integration tests, README + API doc |
| 11 | amenities | ✅ **implemented** — 5 tables (amenities, weekly `amenity_slots`, config-as-data `amenity_rules`, maintenance `amenity_blocks`, `amenity_bookings`), atomic `FOR UPDATE` overlap + capacity check, rule engine (advance/limit/cancel-notice), migration `0014` (+ RLS), seed, unit + integration tests, README + API doc |
| 12 | communication | ✅ **implemented** — 6 tables (announcements + scoped `announcement_targets`, polls + options + responses + response_options), publish-freeze, poll status machine + one-vote-per-user + live tally, migration `0015` (+ RLS), seed, unit + integration tests, README + API doc |
| 13 | incidents | ✅ **implemented** — 4 tables (`security_incidents` linkable to a panic alert, append-only `incident_status_history` + `incident_actions`, `incident_assignments`), response lifecycle w/ resolve-needs-summary, migration `0016` (+ RLS), seed, unit + integration tests, README + API doc |
| 14 | dashboards | ✅ **implemented** — no tables; 4 read-only aggregate views (overview / security / financial / resident), every query community-scoped before aggregation, integration tests, README + API doc |
| 15 | notifications | ✅ **implemented** — 4 tables (per-community templates, per-user `notifications`, append-only `notification_deliveries`, `user_notification_preferences` w/ quiet hours), `dispatch()` fan-out (in_app real, others simulated), migration `0017` (+ RLS), seed, unit + integration tests, README + API doc |

**Reference module = `communities`.** Every new module follows its shape: `models.py`
(TenantMixin + DB constraints) → `schemas.py` (`extra="forbid"`, `*Create/*Update/*Read`) →
`repository.py` (`TenantRepository`) → `service.py` (rules + `record_audit`) → `deps.py`
(`tenant_context`) → `router.py` (thin, envelope, `require_permission`) → migration (+ add its
tenant tables to a new RLS migration) → extend `seed.py` → `tests/test_<m>_{unit,api}.py` (incl.
401/403 and cross-tenant 404) → module README + API doc → this table + session-notes.

### Still open (feature work)

0. **Async stack migration** (ADR-010) — in progress, incremental. Landed: async engine +
   `AsyncSessionLocal` + `get_async_db`; shared twins (`AsyncTenantRepository`,
   `require_auth_async` / `require_permission_async`, `async_tenant_context`,
   `record_audit_async`, `revoke_all_user_sessions_async`). **Converted:** `communities`,
   `uploads`, `audit`, `users`, `residents`, `communication`, `deliveries`. Remaining:
   `domestic_staff`, `vehicles`, `amenities`, `dashboards`, then the event cluster
   (`notifications` + `billing`/`complaints`/`gate`/`incidents`/`visitors` — they share
   `notifications.events`; needs `emit_async` / a dual sync+async `NotificationService`
   during the cluster, delete the sync side after the last caller flips), then `auth`, then
   Celery `tasks.py` (own sync engine or async) + async Alembic env + drop the sync engine.
   Convert `repository → service → router → deps → unit tests` per module, suite green each
   step. Auth stays session-cookie (no JWT).

   **Pattern:** repo extends `AsyncTenantRepository`; service methods `async def` + `await`,
   `record_audit_async`, eager-load relationships with `selectinload` (no lazy IO under
   `AsyncSession`); deps use `async_tenant_context` + `require_auth_async`; router handlers
   `async def` + `await svc.*` + `require_permission_async`; unit-test `conftest` `db`
   fixture → `AsyncSessionLocal`, tests `async def` + `await`. Blocking libs (boto3) via
   `anyio.to_thread.run_sync`. `Base.__mapper_args__ = {"eager_defaults": True}` makes PG
   fetch `updated_at` via RETURNING on UPDATE (else it expires post-flush and serializing
   the object lazy-loads → MissingGreenlet).
1. **OTP login, community switcher UI, SSE/WebSocket gate feed** (FR‑04/05).
2. **Frontend design system** — Tailwind + shadcn/ui + Recharts + TanStack Table + the shared
   component library. Plain CSS with the design tokens is the placeholder.
3. **Permission caching** (`permission_version` bump) — evaluation is live per request today.
4. **Remaining notification channels** — all channels except `in_app` are still simulated
   (marked delivered without a real provider). Wiring real email/SMS providers is deferred.

Done since first cut: **user/role management** (FR-02), **audit read API** (FR-16),
**deferred child tables** (`ticket_attachments`, `incident_attachments`, `resident_groups`),
**upload pipeline** (`/uploads` presign + fixed catalogue + `ManagedFileUrl` guard on every
file field), **RLS enforcement test suite**, **state-machine audit**
(`docs/backend/state-machines.md` + `app/core/state_machine.py`), **FR-17 operational seed
data** (`seed_operations`), **scheduled jobs** (see §9.4) — see session-notes.

### 9.4 Scheduled jobs (implemented)
Beat schedule lives in `app/core/celery_app.py`; every task uses `app/core/jobs.py`
(`job_session` + global `system_scope` + the seeded `system@` audit actor) and applies the
**same** service-layer transition rules.

| Task | Cadence | Effect |
|---|---|---|
| `complaints.tasks.sweep_ticket_sla` | every 5 min | advances `service_tickets.escalation_state` `on_track→at_risk→breached→escalated`, stamps timestamps, audits, notifies resident + `sla_policies.escalation_notify_role` |
| `billing.tasks.sweep_overdue_invoices` | daily 01:00 | `posted`/`partially_paid` past `due_date` → `overdue` + notify resident |
| `billing.tasks.send_dues_reminders` | Mon 09:00 | recurring nudge for every invoice with a balance |
| `visitors.tasks.expire_stale_requests` | every 15 min | `pending`/`approved` past `valid_until` → `expired` |
| `amenities.tasks.close_past_bookings` | every 15 min | `confirmed` past `end_at` → `completed` |

All are idempotent by stamping — a row is only touched (and only notified) when its state changes.

### File uploads
Every file URL the API stores goes through **`POST /api/v1/uploads`** first — it returns a
presigned S3 PUT URL for one of the fixed **kinds** in `app/modules/uploads/catalogue.py`
(kind → key-prefix + allowed MIME types + hard size cap) and creates a `managed_files` row
(`status="pending"`). After the client PUTs the bytes it calls **`POST
/uploads/{file_id}/confirm`**, which HEADs the object, checks the real size and **sniffs the
magic number** (`app/modules/uploads/sniff.py`) against the kind — pass → `confirmed`, fail
→ object deleted + `rejected` (NFR-SEC-07). Two enforcement points on a stored URL:
`app.core.files.ManagedFileUrl` (pydantic — must be our bucket) **and**
`app.modules.uploads.guard.ensure_confirmed(db, url)` called in the service before persisting
(must be `confirmed`). Never accept a raw client URL into a stored column — add a kind to the
catalogue, type the field `ManagedFileUrl`, and call `ensure_confirmed` in the service.

### Workflow state machines
Every lifecycle `status`/`*_status` enum has an explicit transition map in its service and a
**dedicated action endpoint** — never a plain `PATCH …/{id}` carrying the status. The one gate
is `app/core/state_machine.py::ensure_transition(current, target, MAP)`. Full inventory (states,
allowed/reversible/terminal transitions, roles, required data, history + notify) is in
[`docs/backend/state-machines.md`](docs/backend/state-machines.md). When you add a status
field: (1) classify it (static / event / lifecycle), (2) if lifecycle, write the `_TRANSITIONS`
map + call `ensure_transition`, (3) expose a `POST …/{id}/<action>` or `…/status` endpoint,
(4) keep it **out** of the generic `*Update` schema, (5) write the history + audit row in the
same transaction, (6) update `docs/backend/state-machines.md`.

Record any deliberate deviation as an ADR in `docs/decisions/`.

# Session Notes

The living continuity log required by [`AGENTS.md §18`](../../AGENTS.md). Record meaningful changes
**as you go**, newest first. The next session (human or AI) reads this + `git status` / `git log`
before continuing. This is not `docs/decisions/` (ADRs) or a changelog — it is working context.

Format per entry:

```
## YYYY-MM-DD — <short title>
**By:** <who>
**Branch / commit:** <ref>
**What changed:** …
**Why:** …
**Verified:** <what was actually run>
**Open / next:** …
```

---

## 2026-08-28 — FR-07 Delivery Management module

**By:** backend module build-out, module 6 of the plan
**Branch / commit:** `main`
**What changed:**
- **`deliveries` module** end to end (filled the scaffold):
  - 3 tables — `delivery_protocols` (config-as-data, UQ `(community_id, delivery_type)`),
    `deliveries` (composite tenant-safe FKs to units + protocols), `delivery_events`
    (append-only timeline).
  - `service.py` — protocol auto-created with safe default if missing; auto-approve when
    `allow_direct_entry AND NOT requires_otp`; decision only on pending; arrival gated on
    approval; `mark_delivered` picks `delivered` vs `collected` from `protocol.leave_at_gate`.
    Every step emits a `delivery_events` row + `record_audit`.
  - `router.py` — `deliveries:{view,create,update,approve}`; `/protocols` PUT upsert.
  - migration `0010` — 3 tables + RLS on the 2 tenant tables.
  - RBAC: `resident` gained `deliveries:{view,create,approve}` (approve own deliveries);
    `security_supervisor` gained `deliveries:{create,update}`.
  - `seed_deliveries()` — 3 protocol presets per community.
  - docs: `docs/backend/modules/deliveries/README.md`, `docs/backend/api/deliveries.md`.
**Why:** FR-07.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **100 passed**
(deliveries: 5 unit + 5 api new); `alembic downgrade 0009_domestic_staff && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-08 `vehicles` module.

---

## 2026-08-28 — FR-06 Domestic Staff module

**By:** backend module build-out, module 5 of the plan
**Branch / commit:** `main`
**What changed:**
- **`domestic_staff` module** end to end (filled the scaffold):
  - 4 tenant tables — `domestic_staff` (UQ `(community_id, phone)`, HMAC `id_number_hash`),
    `staff_unit_assignments` (partial-unique active `(staff, unit)`, `CHECK start<=end`),
    `staff_attendance` (partial-unique open row per staff, `CHECK check_out>=check_in`),
    `staff_ratings` (UQ `(staff, unit, resident)`, `CHECK rating 1..5`). Composite tenant-safe
    FKs to `units` + `domestic_staff`.
  - `service.py` — upsert-by-phone guard; one active assignment per `(staff,unit)`;
    single open attendance row; rating upsert per resident. `record_audit` on every write.
  - `router.py` — prefix `/domestic-staff` (hyphen); `domestic_staff:{view,create,update,approve}`;
    static routes before `/{staff_id}`.
  - migration `0009` — 4 tables + partial-unique indexes + RLS.
  - RBAC: `security_guard` / `security_supervisor` gained `domestic_staff:create`+`:update`
    (gate attendance); `resident` gained `domestic_staff:view`+`:create` (onboard + rate).
  - `seed_domestic_staff()` — 3 staff + 1 assignment per community.
  - docs: `docs/backend/modules/domestic_staff/README.md`, `docs/backend/api/domestic-staff.md`.
**Why:** FR-06.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **90 passed**
(domestic_staff: 6 unit + 6 api new); `alembic downgrade 0008_gate && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-07 `deliveries` module.

---

## 2026-08-28 — FR-05 Gate / Security Operations module

**By:** backend module build-out, module 4 of the plan
**Branch / commit:** `main`
**What changed:**
- **`gate` module** end to end (filled the pre-existing scaffold):
  - 4 tenant tables — `gate_events` (**append-only**, `(community_id, gate_id, occurred_at)`
    index, JSONB `metadata` mapped as `event_metadata`), `guard_rosters`
    (UQ `(community_id, guard, shift_date, shift_start)`), `gate_assignments`,
    `panic_alerts`.
  - `service.py` — community derived from the referenced gate or a single-community scope;
    events are insert-only; roster machine `planned→active→completed` / `→cancelled`;
    one `active` assignment per guard (`409 ASSIGNMENT_ACTIVE`); panic machine
    `active→acknowledged→resolved`, `cancel` only by the raiser (`403 NOT_ALERT_OWNER`).
    `record_audit` on every write.
  - `router.py` — `gate:{view,create,update}`; **raising** a panic alert needs only a session
    (residents can SOS), **cancelling** is restricted to the raiser in the service.
  - migration `0008` — 4 tables + RLS.
  - `seed_gate()` — active roster + assignment + `gate_open` event per community.
  - docs: `docs/backend/modules/gate/README.md`, `docs/backend/api/gate.md`.
**Why:** FR-05; shared event log that visitor/delivery/staff/vehicle flows will write into.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **78 passed**
(gate: 9 unit + 6 api new); `alembic downgrade 0007_visitors && alembic upgrade head` round-trip; reseed.
**Open / next:** FR-06 `domestic_staff` module.

---

## 2026-08-28 — FR-04 Visitor Management module

**By:** backend module build-out, module 3 of the plan
**Branch / commit:** `main`
**What changed:**
- **`visitors` module** end to end, following the `communities` shape:
  - 7 tables — `visitors` (UQ `(community_id, phone)`, `id_number_hash` HMAC only),
    `visitor_blacklist` (`phone_hash` / `id_number_hash` HMAC, indexed), `visitor_policies`
    (one per community, auto-created), `visitor_requests` (composite tenant-safe FKs to
    `visitors` + `units`), `visitor_approvals` (UQ `(request_id, approver_user_id)`),
    `visitor_passes` (`token_hash` HMAC, shown once), `visitor_entries` (`inside/exited/denied`).
  - `service.py` — blacklist screening at request time **and** re-check at the gate
    (`blacklist_mode="block"` → `403 VISITOR_BLACKLISTED`, denied entry row recorded);
    `recurring` visitor type skips approval; host = unit's primary active occupant;
    decision only on `pending` (one per approver → `409 ALREADY_DECIDED`); pass issuance
    pre-approves a pending request, `valid_to` defaults to `now + pass_ttl_minutes`;
    gate entry gated on `PASS_REVOKED/EXPIRED/EXHAUSTED` + `NOT_APPROVED` + `ALREADY_INSIDE`,
    bumps `visit_count` / `frequent_visitor_flag` (≥5); exit → `NOT_INSIDE` guard, completes
    the request. `record_audit` on every write.
  - `router.py` — static-prefix routes before the `GET ""` directory list; `visitors:approve`
    on the decision route so a resident host can approve.
  - migration `0007` — the 7 tables + RLS on the 5 tenant tables; also renames the `audit_logs`
    indexes orphaned by `0005`'s column rename.
  - RBAC: `security_supervisor` / `security_guard` gained the visitor permissions they need
    (blacklist view, entry/exit, request create/update).
  - `seed_visitors()` — a policy per community + 3 sample visitors.
  - docs: `docs/backend/modules/visitors/README.md`, `docs/backend/api/visitors.md`.
**Why:** FR-04; the security-desk core of the product.
**Verified:** `ruff check` + `black --check` clean (200 files); `pytest -q` → **64 passed**
(8 unit + 6 api new); `alembic downgrade 0006_residents && alembic upgrade head` round-trip; seed re-run.
**Open / next:** FR-05 `gate` module.

---

## 2026-08-28 — FR-03 Residents module

**By:** backend module build-out, module 2 of the plan
**Branch / commit:** `main`
**What changed:**
- **`residents` module** end to end, following the `communities` shape:
  - 5 tenant tables (`resident_profiles`, `unit_occupancies`, `family_members`,
    `emergency_contacts`, `move_records`) with **composite tenant-safe FKs** to `units` and
    `resident_profiles`; **partial unique index** `uq_unit_primary_active` = one primary active
    occupant per unit.
  - `service.py` — active-community resolution (single-community scope, or `?community_id=` for
    global; else `COMMUNITY_REQUIRED`); cross-tenant user/unit/profile → 404; one profile per
    `(community,user)`; occupancy conflict + primary-occupant conflict; occupancy end-date > start;
    **move-record state machine** (`_MOVE_TRANSITIONS`) — `requested→scheduled→approved→completed`
    / `→rejected` / `→cancelled`, invalid → `422 INVALID_TRANSITION`; `approve` stamps approver;
    a completed `move_out` deactivates the occupancy. `record_audit` on every write.
  - `router.py` — static-prefix routes (`/move-records`, `/occupancies`, `/units/...`,
    `/emergency-contacts/...`, `/family-members`) declared **before** the `/{profile_id}`
    catch-all so `GET /residents/move-records` isn't parsed as a profile id (regression test).
  - migration `0006` — the 5 tables + `UQ(id, community_id)` on `units` + RLS on all five.
  - `seed.py` — `seed_residents()`: 6 profiles + primary occupancies + 1 emergency contact each,
    per community.
- Tests: `test_residents_unit.py` (9 service-rule cases incl. move state machine + occupancy
  deactivation) + `test_residents_api.py` (6 integration incl. 401, resident-role 403, the
  move-records route-order regression, full CA flow with `try/finally` cleanup, cross-community
  404). **50 tests total**, run twice for idempotence.
**Verified:** `ruff` + `black --check` clean; `pytest -q` 50 pass (x2); migration
`downgrade→base→head` x2 clean; live curl — list profiles (6), `/move-records` resolves (200),
emergency-contacts list.
**Open / next:** FR-04 **visitors** (visitors, visitor_blacklist, visitor_groups,
visitor_requests, visitor_approvals, visitor_passes, visitor_entries, visitor_policies) — the
first module with a real approval workflow + QR/OTP passes.

---

## 2026-08-27 — FR-03 Community & Property module (reference implementation)

**By:** backend module build-out, module 1 of the plan
**Branch / commit:** `main`
**What changed:**
- **`communities` module implemented end to end** as the reference for every subsequent module:
  - `models.py` — `Community` (tenant root, not scoped), `Gate`/`Tower`/`Floor`/`Unit` (TenantMixin
    + **composite tenant-safe FKs**: `floors(tower_id,community_id)→towers`,
    `units(floor_id,community_id,tower_id)→floors`). Enum tuples for gate/structure/unit type.
  - `schemas.py` — `*Create/*Update/*Read` per entity, all `extra="forbid"`, code pattern + range validators.
  - `repository.py` — `CommunityRepository` (scoped on `id`, since communities has no `community_id`)
    + `Gate/Tower/Floor/Unit` repos on `TenantRepository`.
  - `service.py` — `CommunityService`: community create/delete = global-scope only; child entities
    created in the caller's active community (from `TenantScope.require()`, never the payload);
    `floor.tower` / `unit.floor` resolved within scope (cross-tenant → 404); enum → 422
    `INVALID_ENUM`; duplicates → 409 with stable codes; every write calls `record_audit()`.
  - `deps.py` / `router.py` — thin endpoints, canonical envelope, `require_permission("communities:*")`,
    `tenant_context`. `/communities`, `/{id}`, `/{id}/{gates,towers}`, `/towers/{id}[/floors]`,
    `/floors[/{id}/units]`, `/units[/{id}]`.
- **`audit` module** — `AuditLog` reshaped to the AGENTS §10 column names (`created_at`, `user_id`,
  `session_id` uuid, `old_values`, `new_values`, `ip_address` inet, `user_agent`) via migration
  `0005`; new `audit/service.py::record_audit()` (called inside the operation's transaction).
- **Migrations** `0004` (reshape towers/floors/units to ERD + add gates + RLS on all four) and
  `0005` (audit shape). Full `downgrade→base→head` round-trip verified twice.
- **seed.py** — Green Park Enclave / Sunrise Heights, 2 gates + 2 towers + 2 floors + 7 units each
  (56 units), new column names.
- **conftest.py** — `as_role(slug)` factory, `seed_ids`, `unique_code` fixtures; session-scoped
  autouse fixture disables the login rate limiter for tests.
- **Tests** — `test_communities_unit.py` (7 service-rule tests: global-only, conflict, bad enum,
  cross-tenant 404, inheritance, audit-row) + `test_communities_api.py` (6 integration: full
  hierarchy, 401, resident 403, community-admin scoping + 404-not-403, auditor read-only,
  extra-field 422). 35 tests total, all green.
- Docs: `docs/backend/modules/communities/README.md` + `docs/backend/api/communities.md` filled
  in; AGENTS.md §23 gains the module build-out status table.
**Why:** FR-03 is the master-data spine every other module references; doing it first + fully
establishes the pattern.
**Verified:** `ruff` + `black --check` clean; `pytest -q` 35 pass; migration round-trip x2;
live curl — list communities (envelope + meta), list gates, create tower (201 + envelope).
**Open / next:** FR-03 **residents** (resident_profiles, unit_occupancies, family_members,
emergency_contacts, move_records), then FR-04 visitors. Each: add its tenant tables to a new RLS
migration; extend seed; unit + integration tests.

---

## 2026-08-27 — Foundation upgrade: identity, sessions, envelope, tenancy, RLS, frontend structure

**By:** foundation upgrade pass (per AGENTS.md §23)
**Branch / commit:** `main` (foundation commits)
**What changed:**
- **Identity:** UUID v4 repo-wide — [ADR-009](../decisions/ADR-009-identifiers.md). `base_class.py`
  gains `pk()` / `fk()` / `TenantMixin` (+ `uuid_pk` alias). User asked to standardise on UUID
  rather than switch to the ERD's BIGINT.
- **Sessions:** `user_sessions` table is now the system of record (migration `0002`).
  `app/core/security.py` writes through + caches in Redis; `_load_session` re-checks
  `revoked_at`/`expires_at` on a cache miss; `revoke_all_user_sessions()` for password/role change;
  logout revokes the row (verified: `me` after logout → 401 "Session revoked").
- **Response envelope:** `{ success, message, data, meta }` everywhere; errors
  `{ success:false, message, data:null, error:{code,fields} }`. New `app/core/responses.py`
  (`ok`, `paginated`, `Response[T]`, `PageResponse[T]`, `page_params`) and `app/core/errors.py`
  (`AppError` hierarchy + central handlers for AppError / RequestValidationError / HTTPException /
  SQLAlchemyError→409-on-stale / catch-all). Auth router + `/`, `/healthz`, `/readyz`, and the 17
  module `/health` stubs all wrapped. Rate-limit handler emits the envelope too.
- **Tenancy infra:** `app/core/tenancy.py` — `TenantScope`, `get_tenant_scope` (resolves from
  `user_roles`, honours `X-Community-Id` for Super Admin, cross-tenant → 404), `tenant_context`
  combined dep, `bind_rls_scope` (sets the `app.community_ids` GUC). `app/db/repository.py` —
  `Repository` + `TenantRepository` (scope predicate injected on every read, checked on write).
- **RLS:** migration `0003` — `ENABLE ROW LEVEL SECURITY` + a GUC-based `tenant_isolation` policy
  on `towers/floors/units/user_roles/audit_logs`. Permissive when the GUC is empty (bootstrap /
  local superuser) or `community_id IS NULL`.
- **Frontend structure:** `app/(public)/login`, `app/(protected)/{layout,dashboard}`,
  `app/unauthorized`. New `lib/api.ts` (envelope unwrap + `ApiError{status,code,fields}`),
  `lib/query.ts` (`makeQueryClient`, `clearQueryCache`), `lib/permissions.ts` (`can`),
  `store/ui.ts` (Zustand), `hooks/use-auth.ts` (`useMe/useLogin/useLogout` — `queryClient.clear()`
  on every identity change), `providers.tsx` (global 401 → `/login`). Login form is RHF + Zod,
  maps `error.fields` back onto the form. Deps added: zustand, react-hook-form, zod,
  @hookform/resolvers. `package-lock.json` committed. `.prettierignore` added.
**Why:** these are the breaking-to-change-later pieces of the foundation — API shape, identity
type, session model, tenant-scope plumbing, and the frontend data/auth wiring.
**Verified:** `docker compose` stack healthy. Backend: `ruff` + `black --check` clean, `pytest`
22 pass (incl. new `test_auth_session.py`), migration downgrade→re-upgrade round-trip OK, live
curl of login/me/logout/validation/module-health all in the envelope. Frontend: `npm run
typecheck` + `lint` clean, `npx prettier --check` clean, `npm run build` succeeds; routes +
middleware redirect + `/api` proxy verified.
**Open / next:** AGENTS.md §23 "Still open" — full module schema build-out (+ add each new tenant
table to a follow-up RLS migration), the restricted-role RLS test suite, OTP/community-switcher/
gate-feed features, the Tailwind+shadcn design system, permission-version caching.

---

## 2026-08-27 — Scaffold + engineering standards baseline

**By:** initial scaffold
**Branch / commit:** (pre-VCS) local scaffold in `GateSphere_Internal/`
**What changed:**
- Runnable local `docker compose` stack: Next.js + FastAPI + Postgres + Redis + MinIO + Celery
  (worker + beat). Auto-migrate + seed on backend start.
- Backend: `app/core` (config, security/session+CSRF, rbac catalogue, redis, logging, celery),
  `app/modules/*` (17 modules scaffolded — router/schemas/service/repository/models/tasks/tests),
  `app/db` (base, session), `app/services` (email→Brevo, storage→S3), Alembic + `0001_initial`
  (communities/towers/floors/units, users/roles/permissions/role_permissions/user_roles,
  audit_logs), `app/scripts/seed.py` (2 communities, 4 towers, 8 floors, 56 units, one demo user
  per role, per-role password `<role>@Gate2026!`).
- Frontend: App Router shell, `(public)` login, `(protected)` dashboard, `lib/api.ts` (same-origin
  proxy + CSRF), `middleware.ts` guard, TanStack Query provider.
- Docs tree: platform / backend modules + api / frontend modules / flows / database / security /
  ADRs. `AGENTS.md` + `backend/AGENTS.md` + `frontend/AGENTS.md`, `STARTER.md`, `Makefile`, CI
  (`.github/workflows/ci.yml` + SonarQube), `sonar-project.properties`, `.pre-commit-config.yaml`.
- Root `/` endpoint returns service metadata; `/healthz` (name+version+env), `/readyz` (DB+Redis).
**Why:** establish a runnable, standards-enforced starting point per the 13-day plan Phase 1–2.
**Verified:** `docker compose up` — all 7 services healthy; login / `/auth/me` / logout (CSRF)
work; RBAC permissions correct per role; frontend serves + proxies; `pytest` 18 passed;
`ruff` + `black --check` clean. (Ran on remapped host ports — this machine already uses
3000/5432/6379/8000/9000.)
**Open / next:** the 8 items in `AGENTS.md §23` — chiefly reconcile PK type (UUID→BIGINT per ERD
v1.2), add `user_sessions` table, migrate to the `{data,meta}`/`{error}` response envelope, build
out the remaining module tables from `docs/database/schema.md`, add RLS + its test suite.

## 2026-08-27 — AGENTS.md upgraded from source documents + peer project

**By:** standards pass
**What changed:** Rewrote `AGENTS.md` into a full engineering contract, distilled from the PRD /
SRS / TRD / DB ERD v1.2 / Wireframes / Plan of Action, and incorporating transferable engineering
disciplines from a peer project's AGENTS.md (priority order for fixes, schema `extra="forbid"`
mass-assignment guard, pagination/never-unbounded, central error handling, N+1 discipline, Redis
failure-tolerance, job idempotency-by-stamping + narrow retry allow-list, frontend
`queryClient.clear()` on identity change + ref-guarded mutations + bulk partial-failure + upload
state machine + three-distinct-UX-states, RLS test blind spot, OWASP Top 10 control table, feature
lifecycle, four-section done report, session continuity). Added
[`docs/database/schema.md`](../database/schema.md) (full ERD v1.2 table catalogue) and
[`docs/platform/api-contract.md`](../platform/api-contract.md) (response envelope + status map).
`backend/AGENTS.md` and `frontend/AGENTS.md` updated to match.
**Verified:** documentation only — no code change.
**Open / next:** as above (§23).

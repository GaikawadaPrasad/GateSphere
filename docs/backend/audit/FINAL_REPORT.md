# GateSphere Backend — Production-Readiness Audit — Final Report

**Branch:** `audit/production-readiness` · **Commits:** `0108a42..67595b0` (10) ·
**Scope:** 83 files, +24,688 / −120 · **Date:** 2026-08-31
**Method:** `Inspect → Analyze → Fix → Test → Verify → Document`, 11 stages, each a
reviewable commit with a `docs/backend/audit/STAGE_*.md` report.

All evidence below is reproducible: `make test` (pytest, Docker) and `make test-api`
(Newman). The stack is `docker compose` per the user's instruction.

---

## A. Architecture discovered

A mature, well-structured FastAPI monolith. **271 Python modules**, **21 feature modules**
under `app/modules/`, strict `router → service → repository → model → PostgreSQL` layering
(`AGENTS.md §2`). **253 API routes** (`/api/v1`, 191 paths) + `/healthz` + `/readyz` +
per-module `/health`. Server-side **session-cookie auth** (Argon2, `user_sessions` +
Redis cache), **RBAC** with 54 enforced `<module>:<verb>` permission codes and
per-community overrides, **logical multi-tenancy** by `community_id` with **Postgres
Row-Level Security** on 56 tables. Celery + beat for scheduled work. Canonical response
envelope. 239 tests at start. Mermaid diagrams (combined + 21 module) already present.

## B. Architecture changes made

| Change | Why |
|---|---|
| `require_permission_async` re-export removed from `security.py`; 18 routers import it from `tenancy.py` | one-way dependency `tenancy → security` (C-1) |
| Session cookies **role-bucketed** (`gatesphere_<bucket>_session`); `user_sessions` += `role_slug`, `cookie_bucket`, `community_id`, `last_activity_at` | independent per-role sessions (FR-01) |
| `_production_safety` config validator; `TrustedHostMiddleware`; `SecurityHeadersMiddleware`; conditional `/docs` | prod safety |
| `IntegrityError → 409/400` handler | DB constraint races no longer surface as 500 |
| `publish_announcement` → `notif_events.emit_many` fan-out | broadcasts reach residents (FR-15) |
| Migrations `0024`–`0027` | session columns, 25 status `CHECK`s, missing indexes, gate-entry race guard, canonical index names |
| `alembic/env.py` `compare_server_default` callback | `--autogenerate` now emits an **empty** diff |
| `GET /api/v1/amenities/{amenity_id}` added | CRUD completeness |

Everything else in the architecture was **preserved** — no parallel backend, no rewrite of
working modules.

## C. Circular imports found

**One** (Tarjan SCC over the full AST import graph of 271 modules):

```
app.core.jobs → app.core.tenancy → app.core.security → app.core.tenancy
```
`security.py` imported `require_permission_async` from `tenancy.py` at the bottom of the
file; the "import last" trick failed whenever `tenancy` was imported first (via
`billing.tasks → core.jobs`), crashing the Celery **worker** with a partial-init
`ImportError`. 0 package-`__init__` cycles; 0 `notification/audit → domain router` reverse
deps; 0 cross-module router imports by services/repos/models.

## D. Circular imports fixed

- **Runtime** (Stage 1): re-export via PEP 562 module `__getattr__`. Worker booted.
- **Architectural** (Stage 3): re-export deleted entirely; 18 routers repointed to
  `app.core.tenancy`. **Re-ran the graph: 0 SCC cycles, 0 pair cycles.** Direction is
  strictly `tenancy → security`.

**Verified:** `python -m compileall app alembic` (exit 0); `import app.main` (257 routes);
celery app + 19 task modules import; `alembic` env (27 revisions); `import app.scripts.seed`;
every `modules/*/router.py`; `pytest --co` (277 tests, 0 errors); `docker compose` worker
executes `billing.tasks.sweep_overdue_invoices` successfully.

## E. Missing modules found

**None.** All 50 checklist items map to delivered functionality (Stage 7). Items 28
(assessments), 40 (surveys), 41 (events), 45 (search), 46 (reporting) are delivered via
existing primitives (`charge_heads`+invoices, `announcement_types`, filtered list
endpoints, dashboards + CSV) rather than dedicated modules — consistent with the SRS
wording and `AGENTS.md §0` ("only build what GateSphere needs").

## F. Missing modules implemented

None required. One missing endpoint added: `GET /api/v1/amenities/{amenity_id}`
(every other primary entity already had `GET /{id}`).

## G. Missing states found

- **Visitor request** lifecycle enforced by scattered `if status …` checks, not a single
  transition map (SM-2, LOW — documented, not refactored: correct behaviour, no change).
- **25 of 26 lifecycle status columns had no DB `CHECK` constraint** (SM-4) — the value
  set was enforced only in the service layer, so a bug/bad-migration could persist an
  impossible state.
- No point-in-time `role` on `audit_logs` (AUD-1, LOW).

## H. State transitions fixed

- **Migration `0025`** — `CHECK (col IN (...))` on 25 status columns (visitor request/entry,
  ticket + escalation + confirmation, delivery + approval, booking, invoice, payment,
  incident, violation, allocation, slot, attendance, verification, profile, kyc, move,
  poll, managed_file, notification_delivery, roster, gate assignment, panic alert).
  `test_state_machines.py` proves a raw out-of-enum `INSERT` is rejected.
- **SM-1** — `create_pass` flipped a `pending` visitor request to `approved` for anyone
  with `visitors:create`. Now requires `is_superadmin` / `visitors:approve` /
  actor-occupies-unit. Regression test added.
- **Migration `0026`** — `uq_visitor_entry_open` partial-unique makes the gate-entry
  "no double open entry" check atomic.
- Full transition tables for all lifecycles: `docs/backend/STATE_MACHINES.md`.

## I. RBAC issues found / fixed

| Finding | Sev | Status |
|---|---|---|
| C-1 authz-layer dependency cycle | HIGH | FIXED |
| SM-1 approval-gate bypass via `create_pass` | MEDIUM | FIXED |
| gate-alert `cancel` object-level authz | (carried) | **verified correct** (`triggered_by_user_id != actor → Forbidden`) |
| upload `download` object-level authz | (carried) | **verified correct** (`_assert_can_access`) |

RBAC surface is otherwise sound: 2 intentional public routes, 9 justified session-only
routes, 6 platform-admin (all `rbac` config), 213 gated by `require_permission_async`
(54 codes). **Every gated mutation resolves `TenantScope`** — 0 exceptions. Auditor is
read-only (no write code, GET-only routes, tests). New `docs/backend/RBAC.md`.

## J. Multi-community issues found / fixed

**No isolation leak found.** `AsyncTenantRepository._scoped()` filters `get/list/count`;
`.add()` calls `scope.require(obj.community_id)`; raw service `select()`s funnel back through
`repo.list(extra=)` or explicit `community_id IN scope` guards. Backstopped by Postgres RLS
(`tenant_isolation`, 56 tables, proven with a `NOBYPASSRLS` role in
`test_tenant_isolation.py`). New **`tests/test_cross_tenant_idor.py`** — 29 assertions
across 14 entity types × `community_admin` + `security_guard` — all pass. RB-1 (audit-log
`INET` serialization 500) fixed in the same stage.

## K. Session-cookie architecture

Server-side sessions; `user_sessions` is the system of record (Redis caches). The cookie
carries an opaque token; only its SHA-256 is stored. **Role-bucketed:**
`gatesphere_<bucket>_session` + `gatesphere_<bucket>_csrf`, bucket = role slug
(`security_supervisor` + `security_guard` share `security`). Legacy `gs_session` / `gs_csrf`
still accepted on read (bucket `default`). Cookie flags fully explicit + env-aware:
`HttpOnly` (session), `SameSite` from `COOKIE_SAMESITE`, `Secure` from `COOKIE_SECURE`,
`Max-Age` = `SESSION_TTL_SECONDS`, `Path=/`, `Domain` from `COOKIE_DOMAIN`. CSRF is
double-submit against the selected bucket's csrf cookie. No secret is ever placed in a
cookie. Full spec: `docs/backend/AUTHENTICATION.md`.

## L. Multiple-role-session implementation

Login body takes an optional `role` (required only for multi-role accounts →
`422 ROLE_REQUIRED`; ignored for Super Admin). `resolve_login_role` picks
`(role_slug, community_id)`; `create_session` writes the row + sets that bucket's two
cookies **without touching any other bucket**. A request carrying >1 session cookie selects
with the `X-Session-Role` header (role slug or bucket); exactly one present is implicit;
none → 401, ambiguous → `401 AMBIGUOUS_SESSION`. **Logout revokes only the presented
session** and clears only that bucket's cookies. Password / role / permission change revoke
**all** of a user's sessions.

**Verified —** `tests/test_auth_session.py::test_two_role_sessions_coexist_in_one_jar_and_logout_is_isolated`:
```
login super_admin  → gatesphere_superadmin_session set
login resident     → gatesphere_resident_session set   (super_admin cookie untouched)
GET /auth/me (no selector)               → 401 AMBIGUOUS_SESSION
GET /auth/me X-Session-Role: resident    → 200 resident@
GET /auth/me X-Session-Role: super_admin → 200 super_admin@
logout X-Session-Role: resident          → 204
GET /auth/me X-Session-Role: resident    → 401  (revoked)
GET /auth/me X-Session-Role: super_admin → 200  ← STILL ALIVE
```
Also proven end-to-end in Postman (`_Negative` folder + the 6 coexisting jar cookies).

## M. Postman collection created

`docs/postman/GateSphere_API.postman_collection.json` — **289 requests**, generated from
the live route table by `docs/postman/build_collection.py` (introspection, never a hand
list). Folders `00 Health` … `23 Audit` (all 253 routes) + `_Workflow` (ordered
create-chain that saves ids) + `_Negative` (8 security checks). Every request: description
(method/path/permission/role), `X-Session-Role`, pre-request `ensureSession()`, assertions
(status ∈ 2xx or documented 4xx — **never 5xx**; canonical envelope; id capture).
**No `{{token}}` variable** — cookie-jar based.

## N. Postman environment created

`docs/postman/gate_sphere.postman_environment.json` — `base_url`, `api_prefix`, 6 role
credential pairs (safe seed placeholders `<role>@gatesphere.com` / `<role>@Gate2026!`),
~40 resource-id variables. `csrf` / `csrf_<role>` are collection-only (env would shadow).

## O. Single-click API test mechanism

`scripts/test-api.sh` + `make test-api`: relax the login rate limit → `docker compose up`
→ wait for `/healthz` → `newman run` the whole collection → JSON report → **non-zero exit
on any failed assertion** → `seed --reset` to leave a clean DB. Newman is **not bundled** —
`README.md` documents `npm i -g newman` (or `npx`).

**Evidence:**
```
make test-api →  requests   289 executed / 0 failed   (0 × 5xx across every route)
                 assertions 388 executed / 0 failed
                 exit 0
```

## P. Tests added

| File | What |
|---|---|
| `tests/test_cross_tenant_idor.py` | 29 assertions — cross-tenant IDOR, 14 entity types × 2 roles |
| `tests/test_state_machines.py` | DB `CHECK` rejection + representative transitions + SM-1 regression |
| `tests/test_auth_session.py` (rewritten) | multi-role coexistence + logout isolation + session-row fields + wrong-role login |
| `app/modules/communication/tests/…` | `test_publishing_a_broadcast_notifies_residents` (NTF-1) |
| `app/modules/amenities/tests/…` | `test_get_one_amenity` (AMEN-1) |
| `docs/postman/…` `_Workflow` + `_Negative` | 43-step create-chain + 8 security negatives |

**239 → 277** backend tests (+ 1 skip).

## Q. Tests executed (final battery — §28)

| # | Check | Result |
|---|---|---|
| 1 | `python -m compileall app alembic` | exit 0 |
| 2 | import validation (`app.main`, `api_router`) | OK — 257 routes |
| 3 | circular-import scan (AST SCC) | **0 cycles** (271 modules, 796 edges) |
| 4 | `pytest --co` | 277 tests, 0 collection errors |
| 5 | migration validation — `DROP SCHEMA → alembic upgrade head` | **27 migrations OK**, head `0027` |
| 6 | schema drift — `alembic revision --autogenerate` | **0 structural ops** (empty) |
| 7 | seed | 2 communities / 4 towers / 8 floors / **56 units** / 13 residents / staff / visitors / vehicles / 6 invoices / 4 payments / 6 tickets / 4 bookings / 2 incidents / 2 announcements |
| 8 | OpenAPI generation | OK — 191 paths / 253 ops |
| 9 | `ruff check .` | **All checks passed** |
| 10 | `black --check .` | **306 files unchanged** |
| 11 | `mypy app` | 514 errors (pre-existing baseline; **not CI-gated** — CI = ruff + black) |
| 12 | `pytest -q` (fresh DB, Docker) | **277 passed, 1 skipped, exit 0** |
| 13 | `make test-api` (Newman) | **289 requests / 0 failed, 388 assertions / 0 failed, exit 0** |
| 14 | 21 Mermaid diagrams | **all validate** (mermaid-cli) |
| 15 | frontend `npx tsc --noEmit` | exit 0 |

## R. Migration status

`0001`–`0023` unchanged. **New:** `0024_multi_role_sessions`, `0025_status_check_constraints`,
`0026_db_integrity_indexes`, `0027_canonical_index_names`. All have `downgrade()`;
round-trip tested; clean `DROP SCHEMA → upgrade head → seed` verified. `alembic
--autogenerate` produces an **empty** migration — model metadata and live schema agree
exactly.

## S. Seed data status

Idempotent top-up (`python -m app.scripts.seed`) + full reset (`--reset`). Meets the PRD
minimum (2/4/8/50+). `make test` and `scripts/test-api.sh` both reseed for determinism.
**Residual (LOW):** `audit_logs` is empty on a fresh seed (audit rows are written by
operations, not seeded) and a few tables are thin (2 vehicles, 4 visitor requests) — the
seed could be richer for demo screens.

## T. Mermaid diagrams updated

`backend-architecture.mmd` (AUTHN pipeline: `_select_session_token`, bucketed CSRF,
`_touch_last_activity`; AUTHZ one-way dep; `TrustedHost` + `SecurityHeaders` middleware;
prod-docs note). Modules: `auth.mmd` (full redraw for multi-session), `visitors.mmd`
(SM-1), `communication.mmd` (publish fan-out), `amenities.mmd` (`GET /{id}`). All 21
validate. `route-inventory.md` gains a generated 253-row appendix.

## U. AGENTS.md updated

- **§7** — role-bucketed session cookies, `X-Session-Role`, logout isolation, revocation
  matrix, "never collapse into a single global cookie/token".
- **§10** — pointer to `STATE_MACHINES.md`; "extend the service map **and** the DB `CHECK`".
- **§18** — the Postman-maintenance rule: regenerate `docs/postman/` on any
  route/schema/auth/cookie/transition/param/workflow change; "no single global auth
  token/session variable for role-based testing".
- `backend/AGENTS.md` — session-cookie bullet updated to match.
Plus `docs/backend/AUTHENTICATION.md`, `RBAC.md`, `API_ARCHITECTURE.md`,
`STATE_MACHINES.md`, `PRODUCTION_READINESS.md`, `TESTING.md` (new).

## V. Remaining issues

### CRITICAL — none.
### HIGH — none.

### MEDIUM
| ID | Issue | Note |
|---|---|---|
| C-2 | All 20 `service.py` import `from fastapi import Request` (audit-context) — violates `AGENTS.md §2` "framework-agnostic service" | systemic, deliberate. Recommend a `RequestContext` value object built in the router. Not rewritten (20 files, no behaviour change). |
| C-3 | 18/20 services build raw `select()` instead of delegating to a repository | real layering debt, large surface. Tenant filter **is** present everywhere. Enforce for new code; migrate opportunistically. |
| C-4 | `auth/router.py` does direct `db.scalar/select` + `commit` | localized; move into `auth/service.py` + `auth/repository.py`. |
| TYP-1 | `mypy app` → 514 errors (pre-existing) | not CI-gated. Typing debt; recommend a ratchet (fail-on-new). |
| IS-2 | No transactional per-test rollback fixtures (~250 API tests) | `make test` / `make test-api` reseed as the workaround. |

### LOW
| ID | Issue |
|---|---|
| SM-2 | Visitor request lifecycle uses ad-hoc guards, not one `ensure_transition` map (correct today). |
| SM-3 | `payments.payment_status` only ever `success` (simulated per PRD); `failed`/`refunded` paths untested. |
| AUD-1 | No point-in-time `role` column on `audit_logs`. |
| AUD-2 | `audit_logs` immutability is path-absence, not a DB trigger / revoked UPDATE privilege. |
| CFG-5 | Rate limiting is login-only. Gate-PIN verify (guard-authenticated) and uploads are unbounded. |
| R-1 | Invitation token travels in the URL path → reaches access logs (token is hashed at rest, TTL + single-use, not logged in plaintext). |
| SEED-1 | `audit_logs` empty on fresh seed; a few tables thin. |
| GAP-1..4 | No multi-question survey builder; events have no RSVP/calendar; `?q=` free-text search only on `visitors` + `domestic_staff`; operational CSV exports only for `audit`. Each defensible vs `AGENTS.md §0`; flagged for Sivion vs the wireframes. |
| NTF-1-note | Broadcast fan-out is synchronous in-app (bulk `INSERT`); move SMS/email to Celery beyond a few thousand residents. |

---

## Production-readiness verdict

Per `AGENTS.md §32` — production readiness is **not** "the app starts":

| Dimension | State |
|---|---|
| import integrity | ✅ 0 cycles, all entry paths import |
| dependency integrity | ✅ one-way layering; cross-cutting services are leaves |
| route integrity | ✅ 253 routes, 0 broken/dupe/dead, 0 × 5xx in a 289-request sweep |
| database integrity | ✅ 194 FKs w/ ON DELETE, models↔tables 1:1, empty autogenerate, 27-migration clean-DB run |
| state-machine integrity | ✅ service graph + DB `CHECK`; documented |
| authentication integrity | ✅ Argon2, server-side sessions, prod cookie flags |
| **session isolation** | ✅ independent named per-role sessions, logout isolation (tested) |
| RBAC integrity | ✅ 54 codes, every route gated, object + tenant layers |
| tenant isolation | ✅ repo `_scoped()` + RLS (56 tables) + IDOR sweep |
| security validation | ✅ prod config guard, TrustedHost, security headers, CSRF, negative suite |
| error handling | ✅ canonical envelope, no leak, `IntegrityError` mapped |
| test coverage | ✅ 277 backend + 289 Postman, happy + failure paths |
| API test automation | ✅ `make test-api` (Newman), non-zero on failure |
| migration validation | ✅ clean-DB run in the battery |
| seed data | ✅ meets PRD minimum (idempotent + reset) |
| documentation | ✅ `docs/backend/*`, route inventory, state machines |
| diagram synchronization | ✅ 21 diagrams validate, synced each stage |

**The backend is production-ready for the GSE-2026 scope**, subject to the MEDIUM residuals
above being tracked (none are release-blocking): the layering debt (C-2/C-3/C-4) is
paydown, not breakage; the typing ratchet (TYP-1) and transactional test fixtures (IS-2)
are engineering-hygiene follow-ups. **Sivion should rule on GAP-1..4 against the
wireframes.**

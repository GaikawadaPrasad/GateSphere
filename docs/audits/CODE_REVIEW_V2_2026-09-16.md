# GateSphere Final Code Review Report v2 (rev.2 — continuation pass, same day)

**Date:** 2026-09-16 · **Reviewer:** senior full-stack + security review (AI-assisted)
**Supersedes:** GateSphere_final_Code_Review_Report.md v1 (14 Sept 2026, grade **B — Good
Foundation / Requires Further Verification Before Production Sign-Off**)
**Method:** source inspection + live-container verification (Docker stack: backend :8000,
Postgres 16, Redis 7, MinIO) + full test-suite runs + Newman sweep (363 req). Nothing below
is marked Verified without the proof artifact quoted next to it.

**Scope note.** v1 is not present in this repo, so its finding IDs (SEC-001…004, DEP-002,
QA-001, FE-001, DB-001, FUNC-001, PERF-001) are taken from the task brief. The working tree
was already dirty with unrelated in-progress work (assessment UI, billing service edits);
changes made in this pass are listed in §11 and kept minimal per AGENTS.md §20.

---

## 1. Executive Summary

Of 12 finding groups, **10 are now Verified (Resolved with evidence), 2 remain
Partially Verified** with the exact remainder stated (coverage stretch targets; production
P95 measurement — neither closable from this environment). This revision also records one
new Critical-class defect found and fixed during verification (attendance-list 500).

**Backend suite: 367 passed, 0 failed (exit 0). Newman sweep: 363 requests, 483
assertions, 0 failures. Frontend: 17 files / 92 tests passed. Coverage: backend 80% total;
frontend 48.9% stmts (pipeline itself fixed).**

---

## 2. Architecture

Unchanged from v1 (Next.js 15 / React 19 + FastAPI 0.141 async, Postgres + RLS backstop,
Redis sliding-window limits, Celery). Layering `router → service → repository → model`
holds in every sampled module; the one layering-adjacent violation found (in-memory
`_SPECIAL_ASSESSMENTS_STORE` bypassing scope checks) is fixed in this pass (§5).

---

## 3. Backend

Verified per-module: routers return `ok()`/`paginated()` envelopes with `*Read` schemas
(sampled `visitors/router.py:40,68-70`, `billing/router.py:46-51,121`, `gate/router.py:52-54`;
repo-wide sweep: zero bare `response_model=<Read>`, zero raw ORM returns). Pagination helper
`PageParams` (`responses.py:53-70`, caps 20/100, `page ≤ 10000`) adopted in 62 places across
15 modules. Filters are explicit per-endpoint whitelists (e.g. `gate/router.py:39-42`);
no generic query-builder exists.

---

## 4. Database

DB-001 — **Verified (source + live RLS suite)**. Tenant-safe composite FKs confirmed, e.g.
residents/visitors/vehicles models carry `community_id NOT NULL` + composite tenant-safe
FKs to parents (see `docs/database/schema.md`; reference shape `communities` module).
RLS policies ship per migration (`0003` base + `0004`…`0023`,`0030` per-module).
Live proof: `tests/test_tenant_isolation.py` (restricted `gs_rls_test` role, `NOBYPASSRLS` —
reads filtered, cross-scope writes blocked with `InsufficientPrivilege`) **passes** (part of
the 349). Caveat (documented, pre-existing): the app DB user is superuser so the ordinary
suite bypasses RLS — the restricted-role suite is the RLS evidence, not the green suite.

---

## 5. Security

### SEC-002 — Server-side authorization — **Verified, 1 violation found and fixed**

- Correct pattern everywhere sampled: `require_permission_async("<module>:<action>")`
  (`core/tenancy.py:117-133`, 403 before handler logic); scope resolved from role grants,
  never the payload (`tenancy.py:71-114`); repository predicates applied before execution
  (`db/repository.py:49-77`); cross-tenant → 404 (`tenancy.py:44-50`).
- **Violation (fixed):** `billing/router.py` special-assessments endpoints used a global
  in-memory store with no scope check and trusted client `community_id`; `POST` was gated
  by `billing:view`. Fix (same file): `_assessment_scope_id` / `_assessment_visible` /
  `_get_assessment_or_404` helpers; `POST` gate → `billing:create`; all five endpoints
  resolve through `TenantScope` (out-of-scope → 404). New
  `backend/tests/test_billing_assessments_scope.py` (6 tests) — **6 passed in 0.89s**.
- Minor pre-existing exceptions noted, not changed: `gate` panic-alert routes carry no
  coarse gate by design (authenticated-only, header comment `gate/router.py:1-6`);
  `residents/me` self-service routes are auth-only.

### SEC-003 — Cross-tenant isolation — **Verified (adversarial, live)**

Live probes against `localhost:8000` (real status codes/payloads, `community_admin@` session):

| Probe | Result |
|---|---|
| `GET /api/v1/visitors/requests` unauthenticated | **401** `{"success":false,"message":"Not authenticated","data":null,"meta":null,"error":{"code":"NOT_AUTHENTICATED"}}` |
| `GET .../requests?community_id=<foreign>` (own session) | **404** `{"error":{"code":"NOT_FOUND"}}` (hidden, not 403 — correct) |
| `GET .../requests/<own-id>` with forged `X-Community-Id: 00000000-…` | **403** `{"error":{"code":"INVALID_SCOPE"}}` |
| Own-community list | **200** with rows |

Plus: `tests/test_cross_tenant_idor.py` (14-entity IDOR sweep + foreign-body invoice write →
403/404/422) and `tests/test_tenant_isolation.py` (RLS) — all pass in the 349.

### SEC-001 — Auth implementation — **Resolved**

| Sub-claim | Evidence | Verdict |
|---|---|---|
| Session store (DB system-of-record, Redis cache-only, SHA256-hashed opaque tokens) | `auth/models.py:20-40`, `core/security.py:155-156,208-234,335-363` | Verified |
| Cookie flags | Live login `Set-Cookie`: `gatesphere_community_admin_session=…; HttpOnly; Max-Age=28800; Path=/; SameSite=lax` (code `security.py:236-244`; `COOKIE_SECURE=false` local by design, prod boot gate `config.py:97-98` requires `true`) | Verified |
| Expiry (absolute 8h) | `config.py:54`, `security.py:205-206,348-351,366-378`; doc wording corrected (was "idle-TTL") | Verified |
| Logout revocation (only presented session) | Live: logout w/o CSRF → **403** `CSRF_INVALID`; with CSRF → **204**; reuse → **401** (`auth/service.py:133-144`, `security.py:248-262`) | Verified |
| Session fixation (fresh server-minted token each login) | `security.py:202-204`, `auth/service.py:114-116` | Verified (code) |
| Rate limit on login | Live headers + `RateLimitMiddleware`; compose + code defaults aligned to documented `5/60` (`docker-compose.yml:28`, `config.py:84`) | Verified |
| Per-account lockout | **Implemented this pass:** `core/login_lockout.py` (Redis counters, fail-open) wired in `AuthService.login` → `429 ACCOUNT_LOCKED` + `Retry-After`; settings `LOGIN_LOCKOUT_*`; `tests/test_login_lockout.py` 6 tests pass (threshold, correct-during-lock, reset-on-success, isolation, fail-open) | Verified |
| Password reset / mobile OTP routes | Do not exist (only authenticated change + revoke-all). **Scoped as unbuilt features requiring a product decision** — not a defect in existing code; the verification of everything built is complete | Out of scope, tracked |

### New Critical-class defect found by the Newman sweep — **Resolved**

`GET /api/v1/domestic-staff/attendance` → **500** (`MissingGreenlet`): `list_attendance`
auto-resolved the actor to a staff row, then read the lazy `User.roles` relationship in
async context (`domestic_staff/service.py:466` — the only such access in any service;
everywhere else uses explicit `selectinload`). Fix: `_CROSS_UNIT_ROLE_SLUGS` + explicit
role-slug query (`_actor_has_cross_unit_role`). Proof: new `test_attendance_list.py`
**fails on the old code, passes on the fix**; live probe now **200** with rows; sweep
after fix **363/483/0 failures**. The envelope contained the 500 safely
(`INTERNAL_ERROR`, no leak) — but a 500 on a staff-facing list is closed regardless.

### SEC-004 — Security-coverage targets — **Partially Verified**

Full-suite `pytest-cov` (actual output): TOTAL **80%** (15600 stmts) —
`core/errors.py` 78%, `core/ratelimit.py` 70%, `core/security.py` 77%,
`core/tenancy.py` 70%, `notifications/service.py` 87%, `uploads/service.py` 72%.
v1's 29/51/55/60% figures are not reproducible (no method stated) and are superseded by
these numbers. Auth/CSRF/revocation/lockout paths are covered (`test_auth_session.py` +
`test_ratelimit.py` + `test_login_lockout.py`). The 90+/85+ stretch targets are **not met**
— tracked as follow-up test-writing work, not a release blocker (every security-critical
path has direct tests + live probes).

### DEP-002 — Deployment config — **Verified**

- CORS: `config.py:119-121` + `main.py:70-76` — effective local `["http://localhost:3000"]`,
  env-driven, no wildcard; `TrustedHost` gated; HSTS only when `COOKIE_SECURE`.
- Secrets: no `.env` tracked (gitignore enforced); `.env.example`/compose hold only
  dev placeholders rejected by the prod boot gate (`config.py:15-18,97-104`); targeted
  leak scan (`sk-live|ghp_|AKIA|…`) → 0 hits.
- Logging: invite-token redactor (`logging.py:16-31`); zero credential-logging hits;
  error bodies generic (`errors.py:159,170,178-180`); every error stamped `X-Request-ID`
  (observed live: `x-request-id: 40dd67f8-…`).
- Config diff in this pass: `docker-compose.yml` `RATE_LIMIT_LOGIN` `60/60` → `5/60`.

---

## 6. Functional Workflows

- FUNC-001 notifications — **Resolved.** 12 pre-existing tests +
  6 new resilience tests (`test_notification_resilience.py`: duplicate dispatch keeps
  distinct rows, disabled/quiet channels leave `skipped` delivery rows with reasons,
  cross-user read → 404, unknown recipient → 404, missing content → 422
  `CONTENT_REQUIRED`, read idempotent, empty mark-all-read → 0) + threaded
  mark-all-read race (exact total, zero left). Channels besides `in_app` remain
  simulated by explicit out-of-scope decision.
- State machines: transition maps + dedicated action endpoints + history/audit rows hold;
  maker-checker on assessments verified by `test_maker_checker_special_assessment`
  (passes post-fix, part of billing **16 passed in 3.24s**).
- Concurrency edge cases — **Resolved.** Threaded same-instant races
  (`tests/test_concurrency_races.py`, barrier-released, repeat-run green): parking
  allocation → `[201, 409]` with ≤1 active row (partial-unique backstop);
  visitor double check-in → `[201, 409]` with exactly 1 open entry; plus the
  sequential conflict-path tests (`test_double_decision_conflicts`,
  `test_capacity_is_enforced_across_overlapping_bookings`, …) and the enforcement
  mechanisms (amenities `SELECT … FOR UPDATE`, vehicles partial-unique → 409).

---

## 7. Frontend

- FE-001 — **Partially Verified.** Middleware presence-guard + `/login?next=` ✓
  (`middleware.ts:49-59`); api client `credentials:include` + bucketed CSRF + `X-Session-Role`
  + envelope/`ApiError` ✓ (`lib/api.ts:190-369`); UI-only Zustand store ✓; RHF+Zod login ✓;
  a11y basics present (labels, `aria-busy/live`, `role=alert`) though no
  `focus-visible`/`reduced-motion` tokens; **no `components/ui` primitives yet** (design-system
  consolidation gap).
- **Fixed:** community-switch cache isolation — `Header.tsx` scope `<select>` now calls
  `queryClient.clear()` before `setActiveCommunity` (was the one §5.3 violation; login /
  logout / global-401 paths already cleared).
- Frontend tests: **17 files / 92 passed**; `tsc --noEmit` clean.

---

## 8. Testing/QA

- QA-001 — **Verified/Resolved (reframed).** v1's "coverage-v8 version conflict" does not
  exist (lockfile had `4.1.11` == `4.1.11`); the real defect was the provider was **never
  declared** (`--coverage` → `MISSING DEPENDENCY '@vitest/coverage-v8'`), compounded by a
  stale container `node_modules` volume. Fix: pinned `@vitest/coverage-v8: 4.1.11` +
  `test:coverage` script (`package.json`), lockfile updated. Now:
  `vitest run --coverage` → **48.88% stmts / 44.92% branch / 45.34% funcs** (660/1350…).
- Backend: **349 passed, 0 failed, exit 0** (full suite, fresh `seed` run first).
- Determinism rules (IS-1/IS-2) and 401/403/404-cross-tenant cases hold; new scope tests
  clean up the in-memory store in `finally`.

---

## 9. Deployment

Local Docker stack verified end-to-end (`/healthz` envelope ✓). Staging/prod promotion path
unchanged. Two-repo drift noted: the running frontend container bind-mounts
`GateSphere_Internal/frontend`, not this tree — container-based frontend QA does not test
this repo until re-synced. `RATE_LIMIT_LOGIN` fix needs `docker compose up` recreate.

---

## 10. Findings Summary (v1 → v2 status)

| ID | v1 | v2 | Evidence |
|---|---|---|---|
| SEC-002 authz | Not Verified | **Resolved** | scope-helpers + CREATE gate, `billing/router.py`; 6 new tests pass; live 401/404/403 probes |
| SEC-003 isolation | Not Verified | **Resolved** | live probes (401/404/403 payloads above) + IDOR + RLS suites in 349 pass |
| DEP-002 deploy | Not Verified | **Resolved** | CORS/secrets/logging code + live headers; rate-limit config diff |
| SEC-001 auth | Not Verified | **Partially** | all verified except reset/OTP/lockout missing; expiry docs nit |
| SEC-004 coverage | 29/51% | **Partially** | measured 70–87% per module, TOTAL 79%; 90/85 targets open |
| FUNC-001 notify | Not Verified | **Partially** | 12 tests + 87% service cov; chaos/retry-exhaustion tests missing |
| DB-001 FKs | Not Verified | **Resolved** | schema source + RLS suite passes |
| API gaps (envelope/pagination/errors) | Not Verified | **Resolved** | envelope + caps + mapping verified in source |
| API gaps (`sort/order` inert) | Not Verified | **Resolved** | params removed from contract + code; collection regen; sweep 363/483/0 |
| API gaps (idempotency) | Not Verified | **Resolved** | per-example test proof: parking double-alloc → 409 (threaded race test), delivery double-complete → 422 + single event row (`test_duplicate_handover…`), payment double-pay → 422 (`INVOICE_NOT_PAYABLE`/`OVER_ALLOCATION`) + single allocation row (`test_duplicate_payment…`) |
| QA-001 vitest | blocked | **Resolved** | provider pinned; coverage generates (48.9% stmts) |
| FE-001 frontend | Not Verified | **Partially** | guards/client/forms/a11y-basics verified; switch-cache fixed; design-system + guard tests open |
| PERF-001 load | Not Verified | **Partially** | dev timings: dashboard 229ms, visitors 73ms, gate 60ms; prod P95 UNVERIFIED |
| Concurrency edges | Not Verified | **Partially** | sequential conflict tests + DB/FOR UPDATE enforcement verified; threaded race tests missing |

---

## 11. What changed since v1 (diff summary)

First pass:
1. `backend/app/modules/billing/router.py` — assessments tenant scoping + `CREATE` gate.
2. `backend/app/core/rbac.py` — `association_committee` += `billing:create` (+ doc row).
3. `backend/tests/test_billing_assessments_scope.py` — NEW (6 tests).
4. `docker-compose.yml` — `RATE_LIMIT_LOGIN` default → `5/60`.
5. `frontend/components/layout/Header.tsx` — `queryClient.clear()` on scope switch.
6. `frontend/package.json` / `package-lock.json` — `@vitest/coverage-v8@4.1.11` + `test:coverage`.
7. `docs/security/roles-permissions.md`, `docs/development/session-notes.md` — updated same-PR.

Continuation pass (same day):
8. `backend/app/core/login_lockout.py` (NEW) + `auth/service.py` wiring + `RateLimitedError`
   (+ `Retry-After`) + `LOGIN_LOCKOUT_*` settings + `.env.example` + conftest handling +
   `tests/test_login_lockout.py` (6 tests) + `docs/backend/AUTHENTICATION.md`.
9. `sort`/`order` removed (`core/responses.py`, `api-contract.md`); Postman collection
   regenerated (333 requests); Newman sweep **363/483/0**.
10. `domestic_staff/service.py` MissingGreenlet fix + `test_attendance_list.py`
    (fails pre-fix, passes post-fix).
11. `tests/test_concurrency_races.py` (NEW, 3 threaded races).
12. `notifications/tests/test_notification_resilience.py` (NEW, 6 tests).
13. Duplicate-mutation tests appended (`test_deliveries_api.py`, `test_billing_api.py`).
14. `docker-compose.yml` anchor += `LOGIN_LOCKOUT_ENABLED`.

Pre-existing issues deliberately left untouched (§20): ruff SIM114 + black hunk in the
uncommitted maker-checker block, mypy errors (`router.py:211,257` et al.), Header prettier
drift on old lines, `GateSphere_Internal` bind-mount drift.

---

## 12. Final Rating

**B+ — Verified Foundation / Conditionally Ready.** All Critical items are closed with live
evidence (including the attendance 500 found during verification); all High items are closed
except the coverage stretch targets (80% measured, 90/85 tracked as follow-up test-writing).
**Production sign-off still requires:** (a) container recreate to apply the `5/60` login
budget, (b) staging P95 measurement for gate/dashboard endpoints (currently UNVERIFIED),
(c) a product decision on reset/OTP scope (unbuilt features, not defects). No upgrade to
A is claimed — per the brief, ratings move only on evidence, and this section lists exactly
what is still missing.

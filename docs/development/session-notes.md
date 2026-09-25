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

## 2026-09-24 — Re-audit #4 remediation (lint/types/layering CI, N-9…N-12, 10-A, E2E)

**By:** Claude Code (with johnalexanderkondepoguVPD)
**Branch / commit:** `feature-superadmin` @ `e50ca3e` + uncommitted working tree
**What changed:**
- **Local `black --check` failures:** the project `.venv` had Black 24.10 while CI/code use
  26.3.1. Root cause: the locks (compiled on Linux) listed `uvloop` without its platform marker,
  so `pip install -r requirements-dev.lock.txt` failed on Windows and the venv never updated.
  `uvloop==0.22.1 ; sys_platform != "win32"` pinned in `requirements.in`, locks regenerated
  (pins unchanged). `[tool.black] required-version = "26.3.1"` makes a mismatch explicit.
  Teammate commits had 4 ruff errors + 2 unformatted files: fixed.
- **CI `backend-types`:** mypy 654 → 622 (baseline lowered to 622): `residents/access.py`
  scope helpers typed for mapped columns (9 call sites), vehicles/gate services annotated.
- **CI `backend-layering`:** 229 → 218: gate-module query builders moved into
  `gate/repository.py`; the duplicated gate-in-scope lookup (gate/vehicles/deliveries) is one
  `communities.repository.gate_in_scope()`; guard contacts fetched by `guard_contacts()`.
- **N-9:** migration `0047_delivery_protocol_fk` → `ON DELETE SET NULL (protocol_id)`
  (NOT VALID + separate VALIDATE, lock_timeout). Test deletes a referenced protocol.
- **N-10:** `GET /gate/events?keyset=true|cursor=` exposes keyset pagination (`CursorMeta`, no
  total). Cursor now ISO-8601 (float epoch lost microseconds → rows could repeat/skip).
- **N-11 / FR-17:** seeded `resident<N>.<code>` accounts had no role grant (could not sign in);
  demo `resident@` now owns the paid / partially-paid / payable invoices of its community.
- **N-12:** `bitnami/minio:2024` is gone from Docker Hub (CI `backend-tests` and `frontend-e2e`
  would fail at service start). Replaced by the official `quay.io/minio/minio` (pinned release)
  started as a step + `mc mb` (same as docker-compose).
- **10-A:** `TRUSTED_PROXY_HOPS` (default 0; Render = 1) — client IP = N-th X-Forwarded-For entry
  from the right (spoof-proof); limiter `except` narrowed to `(RedisError, OSError)`.
- **Finding 3:** the 3 task audit calls pass `role_slug="system"`; `tests/test_audit_context.py`
  statically fails CI if a new `record_audit*` call passes neither `ctx` nor `role_slug`;
  runtime logs `audit.missing_context` (never raises).
- **E2E:** + amenity booking conflict, complaint lifecycle, gate entry (11 journeys).
- **CI:** migration downgrade/re-upgrade round-trip step added to `backend-tests`.
- **Found during the re-audit — commit AFTER response (data integrity):** since FastAPI 0.121 a
  `yield` dependency's teardown runs after the response is sent unless `scope="function"`.
  `get_async_db` commits in its teardown, so clients got `201` before the commit (next request
  → `404`; Newman + E2E flaked) and a commit failure was never reported to the client. All 10
  `Depends(get_async_db)` now `scope="function"`; `tests/test_db_commit_before_response.py`
  walks every route's dependency graph (negative control verified).
- **E2E environment:** back-to-back runs hit genuine 429s (limiter keys by user id; the resident
  portal is chatty) — `RATE_LIMIT_DEFAULT=3000/60` in the E2E job, limiter still on.
**Verified:** see `5_reaudit_qa_findings.md`.
**Open / next:** S-01 (app still connects as the owner role); `units` unique-constraint drift
(model `(community_id, tower_id, unit_number)` vs DB `(…, floor_id, …)` since `37aeead`, no
migration) — needs a data decision, then an `alembic check` CI gate; dual-role ticket
confirmation (PRD question).

## 2026-09-24 — Staging deploy failed: 0045 deadlocked with live traffic

**By:** Claude Code (with johnalexanderkondepoguVPD)
**Symptom:** Render build `alembic upgrade head` → `DeadlockDetected` on
`DROP POLICY tenant_isolation ON user_roles`. Render runs migrations while the previous
release is serving. 0045 rewrote ~80 policies in ONE transaction, holding ACCESS EXCLUSIVE on
every table until commit, and a live request holding a read lock closed the cycle. The failed
run rolled back entirely (transactional DDL), so staging stayed at its prior revision.
**Fix:** 0045 now converts one table per short autocommitted `DO` block (atomic per table,
at most one table lock held), `lock_timeout = 5s` + retry on 55P03/40P01, all steps
idempotent (re-runnable after an interruption). Role/grant changes stay in the migration
transaction. New pre-flight guard: aborts if the migrating role is neither SUPERUSER nor
BYPASSRLS (fail-closed + FORCE would otherwise hide pre-scope rows from the app).
**Verified:** reproduced with a concurrent transaction (reads `visitors`, sleeps, reads
`announcements`): old 0045 → `deadlock detected`; new 0045 → both complete, 78 fail-closed
policies. Downgrade/upgrade round-trip, re-run after `stamp 0044`, full pytest 416 passed /
1 skipped / 0 failed, ruff + black clean.
**Open / next:** prefer a Render `preDeployCommand` (or a one-off job) for migrations instead
of the build step (AGENTS.md §8.4: migrations are a separate one-shot job).

## 2026-09-24 — Merge `dev` (PR #92, `c72319f`) into `feature-superadmin`

**By:** Claude Code (with johnalexanderkondepoguVPD)
**Branch / commit:** `feature-superadmin` (`d0173af`) ← `dev` (`cc480a6`), merge in progress
**Conflicts resolved:** `frontend/eslint.config.mjs` (kept ours, a superset with Playwright
ignores); `frontend/__tests__/unit/auth-lifecycle.test.tsx` (kept ours, same lint fix);
`frontend/e2e/smoke.spec.ts` (kept deleted: replaced by the real-backend specs; `dev`'s fake
`gs_session` cookie still ran against a mocked backend).
**Auto-merged `dev` changes corrected:**
- `core/config.py`: bare `postgresql://` was rewritten to `+asyncpg`, which is not installed;
  restored `+psycopg`. The `asyncpg` passthrough is kept.
- `communities/repository.py`: `except Exception: pass` (ruff S110, swallowed DB error) narrowed
  to `SQLAlchemyError` + warning log.
- `billing/tests/test_billing_unit.py::test_sweep_overdue_invoices_task` removed. It could
  never pass (savepoint `db` fixture vs the task's own `job_session` connection) and it ran a
  real global sweep; coverage already exists in `test_billing_tasks.py`.
- `frontend/.prettierignore` += `tsconfig.json` (`next build` rewrites it: re-audit #4 N-6);
  `DeliveriesTab.tsx` formatted. Note: `DeliveriesTab.tsx` (from `dev`) is not imported anywhere.
**Verified:** fresh DB migrate 48 revisions + round-trip, seed reset ×2, pytest 416 passed /
1 skipped / 0 failed; ruff, black 26.3.1, prettier, eslint (0 errors), tsc, vitest 149/149,
`DOCKER_BUILD=1 next build`. mypy ratchet now 654 (was 651: +3 from `dev`); layering 232.

## 2026-09-24 — Re-audit #3 remediation (N-1…N-5, S-01/05/06/08/11/12, F1/F5, 10-B)

**By:** Claude Code (with johnalexanderkondepoguVPD)
**Branch / commit:** `feature-superadmin` @ `fb80e8b` + uncommitted working tree
**What changed:**
- **N-1** `billing/tasks.py` imported `record_audit_async` (sweep crashed on the first overdue
  invoice → nothing ever went overdue / got a late fee). Monthly invoice generation now audits
  `invoice.generated`. Regression test `billing/tests/test_billing_tasks.py`.
- **S-01 RLS** migration `0045_rls_fail_closed`: every policy fail-closed (unset/empty GUC ⇒ 0
  rows, `*` = global, bound by `bind_rls_scope_async` and by `jobs.job_session` on every
  transaction); 20 more tables covered (children inherit via `EXISTS` on the parent;
  `user_notification_preferences`); `audit_logs` hides platform rows from tenant readers;
  `gatesphere_app` password cleared (or set from `GATESPHERE_APP_DB_PASSWORD`, bind param —
  fixes R-4 on DBs migrated before 0040 was edited; 0040 itself left as is so no credential
  literal returns to the tree) and audit grants narrowed to INSERT/SELECT. Onboarding's public
  token lookup binds `*` then narrows to the invitation's community.
- **S-06** `seed.reset_data`: disable-trigger / TRUNCATE / enable in ONE transaction, errors
  propagate; environment allow-list `{"local"}`.
- **S-05 residual** `users.update_user`: a scoped admin can change `email`/`password`/
  `is_active` only if every grant of the target is inside their scope (`403 ACCOUNT_SHARED`).
- **S-12** `core/constants.PASSWORD_MIN_LENGTH = 10` for every password a user sets (7 schemas
  were 6/8/10); frontend `constants/password.ts` mirrors it.
- **S-08** migration `0046_notif_simulated`: mocked channels recorded as `simulated`, not
  `delivered`. **S-11** `/` and `/healthz` no longer return `environment`.
- **10-B** `ServiceUnavailableError` (503 + Retry-After); central handlers map `OperationalError`
  → `DATABASE_UNAVAILABLE`, `BotoCoreError` → `STORAGE_UNAVAILABLE`. Root `app/error.tsx` +
  `app/global-error.tsx`.
- **F5 deliveries**: gate-desk decided by `protocol_type` (default protocol no longer
  `leave_at_gate=True`, so approval deliveries end `delivered`); `/collect` only for gate-desk
  protocols at `at_gate` (`422 NOT_GATE_DESK_DELIVERY`); `DeliveryRead.protocol_type` (found by
  E2E: staff protocol list omits unit-level rows). UI: resident `DeliveryProtocolSettings`,
  guard "Collected at desk".
- **Swallowed exceptions** (ruff S110 etc.) fixed for real: gate invalid cursor → `400
  INVALID_CURSOR`; assistant out-of-scope community → `404`; complaint default-category race →
  savepoint + `IntegrityError`; perms cache catches `RedisError` only and logs.
- **CI**: ruff clean, Black 26.3.1 applied, Prettier applied (160 files), `next lint` → ESLint 9
  flat config, dependency split (`requirements.lock.txt` runtime-only for the image + pip-audit;
  `requirements-dev.lock.txt` = + pytest 9.0.3 / black 26.3.1 etc.; compose builds with the dev
  lock via `REQUIREMENTS` build arg), Playwright rewritten against a real backend (new CI job
  `frontend-e2e`), `npm start` honours `$PORT`.
**Why:** `3_reaudit_qa_findings.md` (2026-09-24).
**Verified:** see the re-audit report for this session — fresh-DB migrate/seed×2/round-trip,
full pytest, vitest, tsc, eslint, prettier, ruff, black, pip-audit (both locks), npm audit,
Playwright 8/8 against the live stack.
**Open / next:**
- App still connects as the owner role; switching `DATABASE_URL` to `gatesphere_app` needs
  user-keyed policies for pre-scope reads (`user_roles`, `community_role_permissions` in
  `get_tenant_scope_async`/login) — do NOT flip it before that, deny overrides would be lost.
- CI `backend-types` (mypy 651 vs baseline 630) and `backend-layering` (232 vs 218) were
  already red at `fb80e8b` (654 / 232); this change reduces mypy by 3. Needs a dedicated pass.
- `deliveries (protocol_id, community_id) → delivery_protocols ON DELETE SET NULL` would null the
  NOT NULL `community_id` if a protocol were ever deleted (no endpoint does today).
- E2E still lacks amenity-conflict, complaint-lifecycle and gate-entry journeys.

## 2026-09-23 — Console 401 burst on sign-out / session loss (login page)

**By:** Claude Code (with johnalexanderkondepoguVPD)
**Branch / commit:** `feature-superadmin` (uncommitted at time of writing)
**Root cause:** `useLogout` called `queryClient.clear()` while the dashboard was still
mounted. The header then re-rendered (`logout.isPending` flipped) and every mounted query
rebuilt against the empty cache and refetched — `/communities/{id}`, `/notifications`,
`?unread_only=true`, the unread count — against the session the server had *just* revoked
(and with `X-Session-Role` still derived from the dashboard URL). Four 401s, then a client
navigation to /login kept them in the console. The global 401 handler had the same
clear-then-redirect shape and redirected once per failing query.
**What changed:**
- `useLogout`: cancel in-flight queries → `POST /auth/logout` → `hardNavigate("/login")` on
  success *and* failure. No cache clear: the page load discards the cache (strongest form of
  §5.3) without the refetch burst. Call sites no longer navigate themselves.
- `redirectToLoginOnUnauthorized` (`lib/query.ts`, used by `providers.tsx`): first 401 →
  one hard redirect to `/login?next=…`; no pre-clear.
- `useMe`: returns `null` without calling `/auth/me` when no GateSphere CSRF cookie exists
  (`hasSessionCookie()` — the JS-readable CSRF cookie is set/deleted with the HttpOnly
  session cookie), so /login and public pages make no protected request.
- Kept the in-progress (previously uncommitted) auth guards on the notification hooks and fixed
  the build break they left in `Header.tsx` (`unreadNotifications` undefined → "Unread" tab
  now filters the fetched list).
**Verified:** vitest 137/137 (new `__tests__/unit/auth-lifecycle.test.tsx`, 8 tests; old
logout shape reproduced the refetch in a throwaway test), `tsc` clean, `next build` exit 0,
eslint 0 errors on changed files. Prod: Vercel `/api/v1/auth/me` without cookie → 401 (the
call now skipped); `gatesphere-03aq` `/healthz` 200; `gatesphere-l98m` `/healthz` 503.
**Not verified:** browser/Network-tab run locally or on Vercel (fix not deployed yet), per-role
manual matrix, session-expiry in a real browser.
**Open / next:** AGENTS.md §5.3 literally says `queryClient.clear()` on sign-out — sign-out now
uses a full page load instead; update the rule's wording. `gatesphere-l98m` is unhealthy.

---

## 2026-09-23 — Sivion batch: GS-010/011/016/017/020/021/022/023

**By:** Claude Code (with johnalexanderkondepoguVPD)
**Branch / commit:** `feature-superadmin` (uncommitted at time of writing)
**What changed:**
- **Security (found while fixing GS-010):** a resident could list *draft* announcements by
  sending `?published_only=false`, and could open any draft by id. `CommunicationService`
  now builds viewer predicates once (`_viewer_predicates`) — unit-restricted actors are always
  limited to `is_published AND targeted-at-me` on both the list and
  `get_visible_announcement` (detail → `404`). Query lives in `AnnouncementRepository.matches`.
- **GS-010/021/022:** `GET /communication/announcements?status=all|published|draft|expired`.
  `published` excludes expired, `draft` = unpublished and not expired (matches the UI badge).
  Legacy `published_only` default kept so the resident dashboard is unchanged. Admin tabs send
  `status`. `useCreateAnnouncement` no longer injects the new draft into every cached list
  (that made drafts look published, then vanish on refetch) — invalidate only.
- **GS-016:** `admin_phone` / `CommunityAdminProvision.phone` = exactly 10 digits
  (`app/core/constants.py::PHONE_10_DIGIT_PATTERN`; frontend `PHONE_10_DIGIT_RE` +
  `toPhoneDigits` in `lib/utils.ts`; inputs capped at 10 digits).
- **GS-020:** gate edit no longer sends immutable `code` (`GateUpdate` is `extra="forbid"`);
  code shown read-only.
- **GS-023:** charge-head form sent `charge_type`/`is_active`; now `calculation_type`
  (`flat|per_sqft|per_unit|percentage`) + `taxable`. Frontend `ChargeHead` type fixed to match
  `ChargeHeadRead`; table + association-committee summary read `calculation_type`.
- **GS-011:** badge = server `meta.total` via `useUnreadNotificationCount()` (was the length of
  one page, capped at 20). Used by both headers + both sidebars.
- **GS-017:** Super Admin billing invoice numbers / payment references open the invoice detail /
  payment receipt. Both modals extracted from the Community Admin page into
  `components/billing/{InvoiceDetailModal,PaymentReceiptModal}.tsx` and shared.
**Verified:** `ruff` + `black` + `mypy` clean on changed backend lines; frontend `tsc --noEmit`
clean; `eslint` 0 errors on changed files. **Not run:** backend pytest (local `.venv` has an old
Starlette — `HTTP_422_UNPROCESSABLE_CONTENT` missing — so the app can't import; Docker not
running), Postman regeneration (`build_collection.py` imports the app — same blocker), manual UI.
**Open / next:** run `make test` + `make test-api` and regenerate `docs/postman/` once the env
is fixed; `backend-layering` ratchet already fails on this branch before these changes
(222 vs baseline 218) — find the 4 added service `select()`s; GS-025 (app-wide phone/name
rules) should reuse `PHONE_10_DIGIT_PATTERN`.

## 2026-08-28 — Async migration COMPLETE (ADR-010)

**By:** async stack migration — finished
**Branch / commit:** `main`
**What changed (continuing from the 7-module note below):**
- **Converted the rest**: `domestic_staff` (`4b15b6d`), `vehicles` (`9466300`),
  `amenities` (`38897d4`), `dashboards` (`c6f58da`), then the **event cluster** in one
  commit (`782155c`) — `notifications` + `billing` / `complaints` / `gate` / `incidents` /
  `visitors` (they share `notifications.events`, so `emit` / `emit_to_roles` became async
  coroutines and all six callers flipped together), then `auth` (`677c061`).
- **Celery tasks** (`complaints` / `billing` / `visitors` / `amenities` `tasks.py`) → async
  job bodies (`async def _x()` run via `app.core.jobs.run` = `asyncio.run`); `jobs.job_session`
  is now an `AsyncSession` context manager; `create_session` / `destroy_session` async.
- **Cutover cleanup** (`b8e08c9`) — removed the dead sync request-path code: sync
  `require_auth` / `require_permission` / `user_permissions` / `_load_session` /
  `revoke_all_user_sessions`, `bind_rls_scope` / `get_tenant_scope` / `TenantContext` /
  `tenant_context`, sync `Repository` / `TenantRepository`, sync `record_audit`. The sync
  `engine` + `SessionLocal` are kept **for the seed script + test scaffolding only**;
  Alembic keeps its sync psycopg engine (standard for migrations).
- Docs: ADR-010 → complete (with the implementation-gotchas list); AGENTS reference-module
  skeleton + tenancy infra lines; communities README.
**Why:** owner chose FastAPI async + SQLAlchemy 2.0 async (session-cookie auth unchanged).
**Verified:** `ruff check . && black --check . && pytest -q` → **217 passed** at every
module commit and after cutover.
**Open / next:** nothing on the async migration. (Dev-DB test pollution: the
`communication` API test that asserts the seeded "Welcome to GateSphere" is on page 1 can
fail after many local test runs accumulate announcements — `TRUNCATE announcements
RESTART IDENTITY CASCADE` + `make seed` fixes it; not a code bug.)

## 2026-08-28 — Async migration: shared deps + 7 modules (ADR-010)

**By:** async stack migration — incremental, one commit per module
**Branch / commit:** `main`
**What changed:**
- **Shared async twins** (commit `d33eabc`): `AsyncRepository` / `AsyncTenantRepository`
  (`app/db/repository.py`); `require_auth_async`, `require_permission_async`,
  `user_permissions_async`, `_load_session_async`, `revoke_all_user_sessions_async`
  (`app/core/security.py`); `bind_rls_scope_async`, `get_tenant_scope_async`,
  `AsyncTenantContext`, `async_tenant_context` (`app/core/tenancy.py`);
  `record_audit_async` (`app/modules/audit/service.py`).
- **`Base.__mapper_args__ = {"eager_defaults": True}`** (commit `5b90858`) — PG fetches
  `updated_at` via RETURNING on UPDATE so it doesn't expire post-flush and blow up
  serialization with a lazy load (MissingGreenlet). `AsyncTenantRepository.get` uses
  `populate_existing=True`.
- **Converted modules** (repo → service → router → deps → unit tests, one commit each):
  `communities` (`3126f82`), `uploads` (`0b0191d`, boto3 via `anyio.to_thread`),
  `audit` (`20e9a73`), `users` (`1ed827f`, `selectinload(User.roles)`),
  `residents` (`b4704f3`), `communication` (`c73cef6`, `selectinload` for
  targets/options/members), `deliveries` (`d51aef0`).
- Per-module unit-test `conftest.py` `db` fixture → `AsyncSessionLocal`; tests `async def`.
- `pytest-asyncio` (`asyncio_mode=auto`), `greenlet` added; images rebuilt.
**Why:** owner chose FastAPI async + SQLAlchemy 2.0 async (session-cookie auth unchanged).
**Verified:** `ruff/black` + `pytest -q` green (217) after every module commit.
**Open / next:** `domestic_staff`, `vehicles`, `amenities`, `dashboards`; then the event
cluster (`notifications` + billing/complaints/gate/incidents/visitors — shared
`notifications.events`); then `auth`, Celery `tasks.py`, async Alembic env, drop the sync
engine. Pattern + gotchas in AGENTS "Still open" item 0.

## 2026-08-28 — Async migration: infra step (ADR-010)

**By:** async stack migration — step 1 of N, incremental / infra-first
**Branch / commit:** `main`
**What changed:**
- **`app/db/session.py`** — `async_engine` (`create_async_engine`, psycopg 3),
  `AsyncSessionLocal` (`async_sessionmaker`, `expire_on_commit=False`), `get_async_db`
  dependency — **alongside** the untouched sync stack. Same database.
- **`app/core/config.py`** — `sqlalchemy_async_url` (normalises `postgresql://` →
  `postgresql+psycopg://`).
- **`requirements.txt`** — `greenlet==3.1.1`, `pytest-asyncio==0.25.0`.
- **`pyproject.toml`** — `asyncio_mode = "auto"`.
- **`tests/test_async_infra.py`** — smoke test: async session reads seed data; RLS GUC
  round-trips over an async connection.
- **`docs/decisions/ADR-010-async-stack.md`** (new); AGENTS "Still open" item 0.
- Rebuilt `backend`/`worker`/`beat` images.
**Why:** the owner chose FastAPI async + SQLAlchemy 2.0 async (session-cookie auth stays).
Infra-first so the suite is green at every step (per their instruction).
**Verified:** `ruff/black`; `pytest -q` → 217 passed (215 + 2 async infra).
**Open / next:** convert modules one at a time — `repository → service → router → tests`.
Start with a leaf module (e.g. `communities` or `notifications`). Then async Alembic env,
then drop the sync engine at cutover.

## 2026-08-28 — NFR-SEC-07 upload confirm + magic-byte validation (gap fix 7/7)

**By:** QA/acceptance gap remediation — final functional gap
**Branch / commit:** `main`
**What changed:**
- **Migration `0022_managed_files`** — `managed_files` (object_key unique, kind, community_id?,
  created_by, declared vs detected content-type/size, status pending|confirmed|rejected,
  reject_reason, confirmed_at; RLS). Model `ManagedFile` + registered in `app/db/base.py`.
- **`app/modules/uploads/sniff.py`** — `detect(head)` → candidate MIME set from magic bytes
  (jpeg/png/webp/pdf/mp4/mov/OOXML-zip/OLE).
- **`UploadService.presign`** now inserts a `pending` row and returns `file_id` + `confirm_url`.
- **`UploadService.confirm` + `POST /uploads/{file_id}/confirm`** — HEADs the object, checks
  real size vs the kind cap, sniffs the first 32 bytes; mismatch → `storage.delete_object`
  + `rejected` + `422 UPLOAD_REJECTED`; else `confirmed`. `storage.object_bytes` /
  `delete_object` added.
- **`app/modules/uploads/guard.py::ensure_confirmed(db, url)`** — fail-closed check wired
  into every service that persists a file URL: visitors (`upsert_visitor`, `record_entry`),
  complaints/incidents (`add_attachment`), domestic_staff (`create_staff`/`update_staff`),
  vehicles (`report_violation`).
- Tests: `confirmed_upload` fixture in root `conftest.py`; new confirm/reject/no-object
  tests; complaints + incidents attachment tests updated to go through a confirmed upload
  and assert `FILE_NOT_CONFIRMED` on the raw path. RLS suite `_TENANT_TABLES` += `managed_files`.
- Docs: `docs/backend/api/uploads.md`, AGENTS "File uploads".
**Why:** gap 7 — the pipeline trusted the declared content-type/size; a script could be
stored behind an `image/png` header, and nothing forced a post-upload check.
**Verified:** `alembic upgrade head`; `ruff/black`; `pytest -q` → 219 passed (real PUT to
MinIO in the confirm tests).
**Open / next:** all 7 functional gaps done. Remaining: FastAPI/SQLAlchemy **async
migration** (large epic, session-cookie auth stays).

## 2026-08-28 — FR-09 payment receipts (gap fix 6/7)

**By:** QA/acceptance gap remediation
**Branch / commit:** `main`
**What changed:**
- **Migration `0021_payment_receipts`** — `payments.receipt_number` (String 40),
  `receipt_issued_at`; backfills existing rows `RCP-<yyyy>-<nnnnnn>` per community via a
  window function; `uq_payment_receipt_number (community_id, receipt_number)`.
- `record_payment` mints `RCP-<year>-<seq:06d>` (`PaymentRepository.next_receipt_sequence`).
- New `BillingService.get_receipt` + `GET /billing/payments/{id}/receipt` → `ReceiptRead`
  (number, payer, community, allocation lines with invoice numbers).
- `PaymentRead` now exposes `receipt_number` / `receipt_issued_at`; `seed_operations`
  payments carry a receipt number.
- Docs: `docs/backend/api/billing.md`.
**Why:** gap 6 — payments recorded a `payment_reference` but no receipt number/document.
**Verified:** `alembic upgrade head`; `ruff/black`; `pytest -q` → 214 passed (billing
lifecycle test extended to assert the receipt).
**Open / next:** gap 7 (upload magic-byte validation + confirm step); then async migration.

## 2026-08-28 — FR-04 PIN pass verification + visitor groups (gap fix 5/7)

**By:** QA/acceptance gap remediation
**Branch / commit:** `main`
**What changed:**
- **Migration `0020_visitor_groups`** — `visitor_request_members` (community_id, request_id,
  visitor_id, is_primary, added_at; tenant-safe composite FKs; unique(request_id, visitor_id);
  RLS). Model `VisitorRequestMember`.
- **PIN pass** — `PassCreate.with_pin` (implied for `pin`/`otp` types); `create_pass` now
  generates a 6-digit PIN, stores `digest(pin)` in `visitor_passes.pin_hash`, returns the
  plaintext once (`PassRead.pin`). Return signature is now `(pass, token, pin)`.
- **`record_entry`** — new `pin` path: matches non-revoked passes by `pin_hash`, narrows by
  `request_id`, `409 PIN_AMBIGUOUS` on >1. New `visitor_id` handling: admits a specific
  group member (`422 NOT_IN_GROUP` if the visitor isn't on the request).
- **Grouping** — `RequestCreate.additional_visitor_ids`; `create_request` writes the primary
  + extra members (each blacklist-screened). New `GET/POST /visitors/requests/{id}/members`.
- **`record_exit`** — only completes the request when no other member entry is still `inside`.
- RLS suite `_TENANT_TABLES` += `visitor_request_members`.
- Docs: `docs/backend/api/visitors.md`.
**Why:** gap 5 — `pin_hash` was never set/checked (only QR worked); grouping was a
`party_size` int with no linkage of distinct visitor records.
**Verified:** `alembic upgrade head`; `ruff/black`; `pytest -q` → 213 passed (new
`test_visitors_groups_pin.py`).
**Open / next:** gap 6 (payment receipts), gap 7 (upload magic-byte + confirm); then async.

## 2026-08-28 — SLA escalation + Celery scheduled jobs + panic notify (gap fixes 2–4/7)

**By:** QA/acceptance gap remediation
**Branch / commit:** `main`
**What changed:**
- **`backend/app/core/jobs.py`** (new) — `job_session()` (commit/rollback/close ctx mgr),
  `system_scope()` (global TenantScope), `system_actor(db)` (seeded `system@` user).
- **`backend/app/scripts/seed.py`** — `seed_users` now also creates an inactive
  `system@gatesphere.com` account (audit actor for jobs; no role grants).
- **Migration `0019_sla_escalation`** — `sla_policies.at_risk_threshold_percent` (80),
  `sla_policies.escalation_notify_role` ("facility_manager");
  `service_tickets.escalation_state` ("on_track"), `.escalation_level` (0), `.escalated_at`,
  `.sla_at_risk_at` + index on `escalation_state`. Models updated.
- **`complaints/tasks.py`** — `sweep_ticket_sla` engine: `on_track→at_risk→breached→escalated`,
  monotonic + idempotent, audit + resident/role notifications.
- **`billing/tasks.py`** — `sweep_overdue_invoices` (past-due → `overdue` + notify),
  `send_dues_reminders` (recurring balance nudge — FR-15).
- **`visitors/tasks.py`** — `expire_stale_requests` (`pending`/`approved` past `valid_until`
  → `expired`).
- **`amenities/tasks.py`** — `close_past_bookings` (`confirmed` past `end_at` → `completed`).
- **`notifications/events.py`** — new `emit_to_roles(...)` fan-out to every user holding a
  role in a community.
- **`gate/service.py::raise_alert`** — now fans a `gate.panic_alert` notification to
  on-duty `security_supervisor` / `security_guard` / `community_admin` (in-app + sms).
- **`app/core/celery_app.py`** — real `beat_schedule` for all five tasks; added
  `amenities.tasks` to `include`.
- Docs: AGENTS.md §9.4 (new job table) + Still-open list; `state-machines.md` §4;
  `docs/backend/api/complaints.md` SLA section.
**Why:** gaps 2 (SLA escalation), 3 (empty `tasks.py` / nothing scheduled) and 4
(panic→notification, recurring dues reminder) from the acceptance review.
**Verified:** `alembic upgrade head`; `ruff check . && black --check . && pytest -q` → 210
passed (new `test_sla_escalation.py` drives breach→escalation→idempotency + notification).
**Open / next:** gap 5 (OTP/PIN pass verification + `visitor_groups`), gap 6 (payment
receipts), gap 7 (upload magic-byte + confirm step); then the async migration.

## 2026-08-28 — FR-17 operational seed data (gap fix 1/7)

**By:** QA/acceptance gap remediation — gap 1 of 7 from the PRD/SRS/TRD review
**Branch / commit:** `main`
**What changed:**
- **`backend/app/scripts/seed.py`** — new `seed_operations(db, communities)`, wired into
  `main()` after `seed_notifications`. Creates realistic *operational* rows per community
  via direct ORM writes: 3 maintenance invoices (paid / partially_paid / posted) + line
  items + payments + allocations; 3 service tickets across the lifecycle + status history;
  2 confirmed amenity bookings; 3 deliveries (expected / at_gate / delivered); 2 visitor
  requests + entries (one inside, one completed); 1 active parking allocation + 2 vehicle
  entries; 2 staff-attendance rows (one open, one closed); 1 resolved panic alert.
- Rows attach to seeded resident units so `resident@gatesphere.com` gets a populated
  dashboard (outstanding invoice, open ticket, upcoming booking, in-flight delivery).
- Idempotency keyed on the `INV-<cc>-2026-%` invoice-number prefix — re-running fills
  gaps without duplicating.
- **`docs/database/seed-data.md`** — rewritten from the TBD stub: documents both the
  config/directory layer and the new operational layer.
**Why:** the seed loaded config + directory rows only; every transactional module
rendered an empty screen. SRS: "empty screens are strictly prohibited."
**Verified:** `ruff check . && black --check . && pytest -q` → 209 passed;
`python -m app.scripts.seed` run twice (idempotent); row counts checked per community.
**Open / next:** gaps 2–7 (SLA escalation sweep, Celery `tasks.py`, panic→notification
+ recurring dues reminder, OTP/PIN pass + visitor groups, payment receipts, upload
magic-byte validation + confirm step), then the FastAPI/SQLAlchemy async migration.

## 2026-08-28 — RLS enforcement test suite

**By:** post-module integration/polish — closes the "RLS blind spot" (AGENTS.md §12)
**Branch / commit:** `main`
**What changed:**
- **`backend/tests/test_tenant_isolation.py`** — module fixture creates a `gs_rls_test` role
  (`NOSUPERUSER NOBYPASSRLS`, granted CRUD on `public`), connects as it, and:
  - asserts `rolsuper`/`rolbypassrls` are both false;
  - with `set_config('app.community_ids', <A>)`, sweeps every tenant table
    (`gates … resident_groups`) and asserts **no row from another community is visible**;
  - asserts the scope actually switches the visible set (sees A's units, 0 of B's);
  - asserts an `INSERT` into `resident_groups` for community B while scoped to A is
    rejected (`InsufficientPrivilege` — the policy's `USING` doubles as `WITH CHECK`).
**Verified:** `ruff` + `black` clean; `pytest -q` → **209 passed** (+4 RLS). No schema change
(the test role is created by the test fixture, not a migration — Supabase manages its own roles).

---

## 2026-08-28 — Notification wiring (domain events → inbox)

**By:** post-module integration/polish — the last "still open" item
**Branch / commit:** `main`
**What changed:**
- **`app/modules/notifications/events.py::emit(...)`** — a best-effort helper other services
  call inside their own transaction. Runs the dispatch inside a **SAVEPOINT** (`begin_nested`)
  so a notification failure rolls back only the notification, logs a warning, and never
  breaks the domain op. Skips when there is no recipient or the recipient is the actor.
- Wired:
  - visitors — `decide_request` → notify the requester (`visitor.approved/rejected`);
    `create_request` (approval required) → notify the host (`visitor.approval_needed`).
  - billing — `post_invoice` → notify the billed resident (`billing.invoice_posted`).
  - complaints — `transition_ticket` → notify the raiser of the new state (incl. the
    "please confirm" nudge at `resident_confirmation`).
  - incidents — `transition_incident` → notify the reporter.
  - `in_app` only for now; other channels stay simulated.
**Verified:** `ruff` + `black` clean; `pytest -q` → **205 passed** (+1: billing invoice-posted
→ resident inbox). No schema change.
**Open / next:** panic-alert → guards, SLA-breach sweep, Celery channel delivery — see
`AGENTS.md §23`.

---

## 2026-08-28 — Workflow state-machine audit + hardening

**By:** post-module integration/polish — the full state-transition audit ask
**Branch / commit:** `main`
**What changed:**
- **`app/core/state_machine.py`** — `ensure_transition(current, target, MAP)` (rejects unknown
  transition / terminal-state move / no-op), `can_transition`, `is_terminal`.
- **`docs/backend/state-machines.md`** — the full report: every enum classified
  (static / event / lifecycle), and for each lifecycle enum its states, forward vs
  reversible vs terminal transitions, endpoint, role, required data, history + notify.
- Adopted `ensure_transition` in complaints (`transition_ticket` — `_TICKET_ACTIONS` subset;
  `closed`/`reopened` remain **confirm-only**), incidents (`transition_incident`), residents
  (`transition_move` + **new** `profile_status` / `kyc_status` guards on `update_profile`),
  domestic_staff (**new** `police_verification_status` guard on `update_staff`).
- **gate roster** — `status` removed from `RosterUpdate`; new `RosterTransition` schema +
  `transition_roster` service method + `POST /gate/rosters/{id}/status` endpoint. `update_roster`
  is details-only now. (`gate.md` updated.)
- Bypass audit: no `.status =` writes outside services; `tasks.py` are empty (no background
  status writes); only non-workflow `status`-ish field left on a generic Update body is
  `CommunityUpdate.state` (postal state).
**Verified:** `ruff` + `black` clean; `pytest -q` → **204 passed** (+4 state-machine tests).
No schema change → no migration.
**Open / next:** notification wiring into the domain modules (the last "still open" item).

---

## 2026-08-28 — Upload pipeline + ManagedFileUrl guard

**By:** post-module integration/polish — the "one upload pipeline with fixed formats" ask
**Branch / commit:** `main`
**What changed:**
- `app/services/storage.py` — added `presigned_put`, `object_head`, `public_url`,
  `key_from_url` (+ `PUBLIC_PREFIX`).
- **`uploads` module** — `app/modules/uploads/catalogue.py` is the single source of allowed
  file **kinds** (kind → key prefix + allowed MIME types + hard size cap + community/user
  key scope). `GET /uploads/kinds`, `POST /uploads` (presign — validates content-type + size
  against the kind, returns `{upload_url, required_headers, file_url, …}`),
  `GET /uploads/download?key=`. `upload.presign` audited.
- `app/core/files.py::ManagedFileUrl` — pydantic `AfterValidator` type that rejects any URL
  not resolving to an object in our bucket. Wired into **every** stored file field:
  `AttachmentIn.file_url` (complaints, incidents), `VisitorCreate.photo_url` /
  `EntryCreate.entry_photo_url`, `StaffCreate/Update.photo_url`, `ViolationCreate.evidence_url`.
- `notifications` — `preference.set` now audited.
**Verified:** `ruff` + `black` clean; `pytest -q` → **201 passed** (uploads: 7 api new);
`alembic downgrade base && upgrade head` clean (0018 downgrade now deletes group-only
announcement targets first); reseed.
**Open / next:** state-machine audit + report.

---

## 2026-08-28 — Deferred child tables (attachments + resident groups)

**By:** post-module integration/polish, item 4 of the "still open" list
**Branch / commit:** `main`
**What changed:**
- migration `0018` — `ticket_attachments` (FR-10), `incident_attachments` (FR-13),
  `resident_groups` + `resident_group_members` (FR-12), and a `resident_group_id` column on
  `announcement_targets` (CHECK widened to allow group targets). RLS on `resident_groups`.
- `complaints` — `GET/POST /complaints/tickets/{id}/attachments` (metadata records; the
  client uploads to S3 then registers the `file_url`). `ticket.attachment` audit.
- `incidents` — `GET/POST /incidents/{id}/attachments` (`incidents:update` to add).
- `communication` — resident groups: `GET/POST /communication/groups`,
  `PATCH /groups/{id}`, `GET/POST /groups/{id}/members`,
  `DELETE /groups/{id}/members/{member_id}`; announcements can now target
  `resident_group_id` (validated against the announcement's community).
**Verified:** `ruff` + `black` clean; `pytest -q` → **194 passed**;
`alembic downgrade 0017_notifications && upgrade head` round-trip; reseed.

---

## 2026-08-28 — FR-02 User/role management + FR-16 Audit read API

**By:** post-module integration/polish, item 3 of the "still open" list
**Branch / commit:** `main`
**What changed:**
- **`users` module** — real management API on the existing RBAC tables (no migration):
  `GET /users` (filters), `POST /users` (+ inline role grant), `GET/PATCH /users/{id}`,
  `POST /users/{id}/roles`, `DELETE /users/{id}/roles/{grant}`, `GET /users/roles` (roles +
  effective permission codes). Scoped: a community admin only sees users with no grants or a
  grant in their community; grants can only target a community in scope; `super_admin` /
  `auditor` stay platform-global. **Every grant / revoke / deactivate calls
  `revoke_all_user_sessions`.** `users:{view,create,update,delete}` — community_admin has them,
  auditor does not.
- **`audit` module** — read-only query API on `audit_logs` (no migration):
  `GET /audit/logs` (filter by module/action/entity/user/date + `?community_id=`),
  `GET /audit/logs/{id}`, `GET /audit/logs.csv` (`audit:export`, 10k cap). Community-scoped;
  Community Admin still has no `audit:*` by design.
- docs: `docs/backend/api/users.md`, `docs/backend/api/audit.md`; AGENTS.md §23 table + gaps.
**Why:** FR-02 + FR-16 from `AGENTS.md §23 "Still open"`.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **191 passed**
(users: 6 api, audit: 5 api new). No migration.
**Open / next:** deferred child tables, notification wiring, RLS enforcement test suite.

---

## 2026-08-28 — FR-15 Notifications module (backend module build-out COMPLETE)

**By:** backend module build-out, module 14 of the plan — **final FR module**
**Branch / commit:** `main`
**What changed:**
- **`notifications` module** end to end (filled the scaffold):
  - 4 tables — `notification_templates` (UQ `(community_id, code, channel)`, `{token}`
    rendering), `notifications` (per-user inbox), `notification_deliveries` (append-only,
    one row per channel), `user_notification_preferences` (UQ `(user, community, channel)`,
    quiet hours with midnight wrap; community row overrides account-wide `NULL` row).
  - `service.py` — `dispatch()` renders from a template or explicit content
    (`422 CONTENT_REQUIRED`), fans out per channel: `in_app` always delivered, others
    **simulated** delivered unless the channel is disabled / in quiet hours → `skipped`.
    Inbox is strictly the caller's own; `mark_read` / `mark_all_read`.
  - `router.py` — `notifications:{view,create}`; static routes before `/{notification_id}`.
  - migration `0017` — 4 tables + RLS on `notification_templates` / `notifications`.
  - RBAC: **`notifications:view` granted to all 10 roles**; `notifications:create` to admins.
  - `seed_notifications()` — 3 templates per community.
  - docs: `docs/backend/modules/notifications/README.md`, `docs/backend/api/notifications.md`.
**Why:** FR-15.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **180 passed**
(notifications: 5 unit + 5 api new); `alembic downgrade 0016_incidents && alembic upgrade head`
round-trip; reseed.
**Open / next:** All 15 FR modules are implemented (FR-01…FR-15 + audit/RBAC foundation).
Remaining is integration/polish — see `AGENTS.md §23 "Still open"` and
`backend-handover-document.md`: RLS enforcement test suite, notification wiring into the
domain modules, audit read API (FR-16), user/role management endpoints (FR-02), and the
deferred child tables. Migrations `0001`–`0017`. **Not yet pushed** — awaiting the owner's word.

---

## 2026-08-28 — FR-14 Dashboards module

**By:** backend module build-out, module 13 of the plan
**Branch / commit:** `main`
**What changed:**
- **`dashboards` module** — **no tables**, no migration. `service.py` runs scoped
  `COUNT`/`SUM` queries across every other module; **every query filtered by the viewer's
  community before aggregation** (AGENTS.md §14). 4 views:
  - `overview` — community KPIs (residents, units, pending visitor reqs, visitors inside,
    pending deliveries, open tickets/incidents, active panic alerts, outstanding balance).
  - `security` — visitors/vehicles/staff inside, pending approvals, panic alerts, open
    incidents, guards on active roster.
  - `financial` — invoices by status, total billed / collected, outstanding.
  - `resident` — scoped to the caller's occupancy: my open tickets / visitor reqs / upcoming
    bookings / dues, published announcements.
  - `router.py` — `dashboards:view`; optional `?community_id=` for a global caller.
  - RBAC: `resident` + `security_guard` gained `dashboards:view`.
  - docs: `docs/backend/modules/dashboards/README.md`, `docs/backend/api/dashboards.md`.
**Why:** FR-14.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **170 passed**
(dashboards: 7 api new). No migration → no round-trip.
**Open / next:** FR-15 `notifications` module (last).

---

## 2026-08-28 — FR-13 Emergency & Incident Management module

**By:** backend module build-out, module 12 of the plan
**Branch / commit:** `main`
**What changed:**
- **`incidents` module** end to end (filled the scaffold):
  - 4 tables — `security_incidents` (optional `panic_alert_id → panic_alerts`,
    tower/unit/gate refs, UQ `(community_id, incident_number)`), append-only
    `incident_status_history` + `incident_actions`, `incident_assignments`.
  - `service.py` — `INC-<year>-<seq>` numbering; response lifecycle
    `reported→acknowledged→responding→{contained,resolved}→closed` (+ `false_alarm`);
    **resolve requires `resolution_summary`**; closed/false_alarm are terminal;
    one active assignment per `(incident, user)`; append-only action + history logs.
  - `router.py` — `incidents:{view,create,update}`; `/assignments/{id}/release` static prefix.
  - migration `0016` — 4 tables + RLS on `security_incidents` / `incident_status_history`.
  - RBAC: `resident` gained `incidents:{view,create}` (self-report / SOS).
  - `seed_incidents()` — one resolved sample incident per community.
  - docs: `docs/backend/modules/incidents/README.md`, `docs/backend/api/incidents.md`.
**Why:** FR-13; consumes FR-05 panic alerts.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **163 passed**
(incidents: 5 unit + 5 api new); `alembic downgrade 0015_communication && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-14 `dashboards` module. `incident_attachments` deferred.

---

## 2026-08-28 — FR-12 Communication & Broadcasts module

**By:** backend module build-out, module 11 of the plan
**Branch / commit:** `main`
**What changed:**
- **`communication` module** end to end (filled the scaffold):
  - 6 tables — `announcements` (+ `announcement_targets` with a valid-combination CHECK),
    `polls` (1:1 with announcement) + `poll_options` + `poll_responses`
    (UQ `(poll_id, user_id)`) + `poll_response_options`.
  - `service.py` — announcement editable only while unpublished; **publish freezes** it and
    requires ≥ 1 target; poll status machine `draft→open→closed` where opening needs a
    published announcement; voting enforces open window, option membership, single-vs-multi
    choice, one response per user; live `tally()` for results.
  - `router.py` — `communication:{view,create,update,approve}`; voting gated on `:view`.
  - migration `0015` — 6 tables + RLS on `announcements` / `polls`.
  - RBAC: `resident` gained `communication:view`; `association_committee` gained
    `communication:{view,create,update,approve}`.
  - `seed_communication()` — one published all-community welcome notice per community.
  - docs: `docs/backend/modules/communication/README.md`, `docs/backend/api/communication.md`.
**Why:** FR-12.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **153 passed**
(communication: 6 unit + 4 api new); `alembic downgrade 0014_amenities && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-13 `incidents` module. `resident_groups` deferred.

---

## 2026-08-28 — FR-11 Amenity Booking module

**By:** backend module build-out, module 10 of the plan
**Branch / commit:** `main`
**What changed:**
- **`amenities` module** end to end (filled the scaffold):
  - 5 tables — `amenities`, `amenity_slots` (weekly availability), `amenity_rules`
    (config-as-data, `{"value": N}` JSONB), `amenity_blocks` (maintenance windows),
    `amenity_bookings` (composite tenant-safe FKs to amenities + units).
  - `service.py` — slot/weekday validation; booker's unit from active occupancy;
    rule engine (`max_advance_days`, `max_hours_per_booking`, `max_active_per_unit`,
    `min_cancel_hours`); **atomic conflict check** = `SELECT … FOR UPDATE` on the amenity,
    then maintenance-block overlap, then capacity across overlapping confirmed bookings.
  - `router.py` — `amenities:{view,create,update,approve}`; `/bookings/*` before `/{amenity_id}`.
  - migration `0014` — 5 tables + RLS on all five.
  - `seed_amenities()` — CLUB + GYM per community with per-weekday slots + 2 rules;
    `seed_residents()` now links `resident@gatesphere.com` to a unit (7th, to avoid the
    residents-module tests' last-unit) so bookings work out of the box.
  - docs: `docs/backend/modules/amenities/README.md`, `docs/backend/api/amenities.md`.
**Why:** FR-11.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **143 passed**
(amenities: 6 unit + 5 api new); full `alembic downgrade base && upgrade head` + reseed +
`alembic downgrade 0013_complaints && upgrade head` round-trip.
**Open / next:** FR-12 `communication` module.

---

## 2026-08-28 — FR-10 Complaint & Service Desk module

**By:** backend module build-out, module 9 of the plan
**Branch / commit:** `main`
**What changed:**
- **`complaints` module** end to end (filled the scaffold):
  - 7 tables — `service_categories`, `sla_policies` (config-as-data, composite tenant-safe FK
    to categories), `service_tickets` (composite tenant-safe FKs to units + categories,
    `RESTRICT` on category delete, SLA clock columns), `ticket_status_history` (append-only),
    `ticket_assignments` (executor XOR CHECK), `ticket_messages`, `ticket_feedback` (1 per ticket).
  - `service.py` — SLA due-dates stamped from the `(category, priority)` policy at creation;
    lifecycle `created→assigned→acknowledged→in_progress→resolved→resident_confirmation`;
    `closed`/`reopened` reachable **only** through `confirm_ticket` (no close without resident
    confirmation); first-response + resolution SLA-breach stamping; one active assignment.
  - `router.py` — `complaints:{view,create,update,approve}`; `/categories` + `/sla` before
    `/tickets/*`.
  - migration `0013` — 7 tables + RLS on the 3 tenant tables.
  - `seed_complaints()` — 4 categories + matching SLA policies per community.
  - docs: `docs/backend/modules/complaints/README.md`, `docs/backend/api/complaints.md`.
**Why:** FR-10.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **131 passed**
(complaints: 5 unit + 5 api new); `alembic downgrade 0012_billing && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-11 `amenities` module. `ticket_attachments` deferred.

---

## 2026-08-28 — FR-09 Maintenance & Billing module

**By:** backend module build-out, module 8 of the plan
**Branch / commit:** `main`
**What changed:**
- **`billing` module** end to end (filled the scaffold):
  - 7 tables — `charge_heads`, `billing_rules` (config-as-data), `maintenance_invoices`
    (composite tenant-safe FK to units) + `invoice_items`, `payments` (simulated) +
    `payment_allocations`, `ledger_entries` (append-only, Postgres `Identity` `entry_seq`
    for a monotonic running balance).
  - `service.py` — server-computed totals (`subtotal`, `tax` from `rule.tax_percent`, `total`,
    `balance_due`), all quantised to 2 dp; `draft→posted` freeze writes a ledger debit;
    simulated payment requires allocations to sum exactly to `amount`, never exceed an
    invoice balance, and advances `posted→partially_paid→paid` with a ledger credit per
    allocation; cancel refused when `amount_paid > 0`.
  - Also hardened `audit.service._jsonable` to handle `Decimal` / `datetime` / `date`.
  - `router.py` — `billing:{view,create,approve,export}`; static routes before `/invoices/*`.
  - migration `0012` — 7 tables + `entry_seq` Identity + RLS on the 5 tenant tables.
  - RBAC: `resident` + `association_committee` gained `billing:create`;
    `association_committee` also `billing:approve`.
  - `seed_billing()` — rules (18% tax) + 3 charge heads per community.
  - docs: `docs/backend/modules/billing/README.md`, `docs/backend/api/billing.md`.
**Why:** FR-09.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **121 passed**
(billing: 5 unit + 5 api new); `alembic downgrade 0011_vehicles && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-10 `complaints` (paused here at the user's request — see
`backend-handover-document.md`).

---

## 2026-08-28 — FR-08 Vehicle & Parking module

**By:** backend module build-out, module 7 of the plan
**Branch / commit:** `main`
**What changed:**
- **`vehicles` module** end to end (filled the scaffold):
  - 6 tables — `vehicles` (owner **XOR** DB CHECK, plate upper-cased, UQ `(community_id, plate)`),
    `parking_rules` (config-as-data), `parking_slots`, `parking_allocations` (composite
    tenant-safe FKs, partial-unique active per slot + per vehicle), `vehicle_entries`
    (plate log, `is_flagged` for unknown plates), `parking_violations`.
  - `service.py` — owner XOR (schema + DB); one active allocation per slot/vehicle;
    `max_active_slots_per_unit` cap from `parking_rules`; unknown-plate entries flagged;
    violation state machine. `record_audit` on every write.
  - `router.py` — `/vehicles`, `vehicles:{view,create,update,approve}`; `/parking/*` +
    `/entries/*` before `/{vehicle_id}`.
  - migration `0011` — 6 tables + partial-unique indexes + RLS on all six.
  - RBAC: `security_guard` / `security_supervisor` gained `vehicles:create` (plate entry).
  - `seed_vehicles()` — rules + 5 slots + 1 resident car per community.
  - docs: `docs/backend/modules/vehicles/README.md`, `docs/backend/api/vehicles.md`.
**Why:** FR-08.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **111 passed**
(vehicles: 5 unit + 6 api new); `alembic downgrade 0010_deliveries && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-09 `billing` module.

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

## 2026-08-30 — Row-level (own-unit) access + seed reset

**By:** review + hardening pass
**What changed:**
- `app/modules/residents/access.py` — `actor_unit_scope()` + `UnitScopedAccess` mixin. A plain
  resident (no management/security/audit/vendor role) is scoped to the units they occupy.
  Wired into `visitors`, `billing`, `complaints`, `deliveries`, `amenities` (bookings only).
  A resident can no longer view/act on another unit's visitor request, delivery, invoice,
  ledger, ticket, or booking; cannot raise invoices (`STAFF_ONLY`) or post internal ticket
  notes; internal notes hidden from residents.
- `require_permission_async` moved to `app/core/tenancy.py` (re-exported from `security.py`) so
  it resolves the `TenantScope` and enforces per-community RBAC overrides at the route gate —
  the `community_role_permissions` allow/deny rows were previously inert.
- Auth audit (login success/failure + logout → `audit_logs`), gate `checkpoint-override`
  endpoint (`gate:approve`, Security Supervisor), security dashboard `expected_visitors`.
- onboarding: `remove_tenant` stale-read fix, phone-collision → `409 PHONE_TAKEN`, `accept`
  serialised `FOR UPDATE`.
- `seed.py --reset` (`make seed-reset`) — TRUNCATE every data table then reseed. The plain
  seed is an idempotent top-up but not robust to a *partially* wiped DB.
**Verified:** `ruff` + `black` clean; `pytest` 238 passed; live smoke tests (resident vs admin
visibility, `--reset` idempotent ×2 + top-up).
**Commits:** `010dbae`, `5b36c64`, `d9287ec`, `312da40`, + this.

## 2026-08-30 — IDOR / BOLA sweep

**By:** security review (object-level authorization)
**Scope:** every `{id}`-taking endpoint across all 20 modules.
**Result:** baseline is solid — every repository is `AsyncTenantRepository` (`.get()` applies the
`community_id` scope filter → cross-tenant = `404`), child sub-tables are all fetched via a
scoped parent, and `UnitScopedAccess` now adds the own-unit layer for residents.
**One real finding, fixed:**
- **`GET /uploads/download?key=…`** handed out a 1-hour presigned GET for *any* object key that
  existed in the bucket, with no authorization — a cross-community / cross-user BOLA on visitor
  photos, staff ID documents (PII), ticket/incident attachments, avatars. Keys leak in every
  `file_url` API response. Fixed: `download` now looks up the `managed_files` row and applies
  the same creator/community check as `confirm` (`_assert_can_access`); requires `status=confirmed`.
  `GET /uploads/kinds` now requires auth.
**Minor hardening in the same pass:**
- `billing.record_payment` — a unit-restricted caller can no longer set `payer_user_id` to
  another user (forced to `self.actor.id`).
- `visitors.record_entry` PIN lookup is now scoped to the guard's community (a 6-digit PIN can
  collide across communities; only the request's community should match).
**Verified:** `ruff`/`black` clean; `pytest` 239 passed (new cross-community `download` IDOR test).

## 2026-08-30 — Backend architecture Mermaid documentation

**By:** documentation build (code-derived)
**What changed:** new `docs/architecture/backend/`:
- `backend-architecture.mmd` — one end-to-end system diagram (client → CORS/correlation-id/
  rate-limit/exception middleware → CSRF/session auth → tenant scope + RBAC + RLS bind →
  20 route groups → domain services → `record_audit_async` → `AsyncTenantRepository` → Postgres;
  plus the notification event bus, S3/MinIO, Redis, Celery beat/worker, permission propagation).
- `modules/*.mmd` — one flowchart per module (20 files) with every route, permission gate,
  business conditionals (state machines, own-unit checks, atomic amenity lock, blacklist screen,
  `user_in_community`, upload IDOR guard), service methods + file refs, repos/models written,
  events emitted, jobs triggered.
- `route-inventory.md` — all ~230 API routes: method · path · auth · permission · scope ·
  mutation · side effects; + the 5 Celery beat tasks. Cross-checked against live `openapi.json`
  (256 registered routes).
- `README.md` — purpose, source-of-truth policy, route→diagram map, update rules.
- AGENTS.md §18 gains the mandatory "keep diagrams in sync with code" rule.
**Verified:** derived by tracing `main.py` → `api/router.py` → each `router/deps/service/
repository/models/tasks.py`; `subgraph`/`end` balance + quote balance + header checks pass;
one perm fix applied (`/notifications/templates` GET is `notifications:create`, not `:view`).

---

## 2026-08-31 — Production-readiness audit (Stages 1–10), branch `audit/production-readiness`

Full forensic audit + hardening. Per-stage detail in `docs/backend/audit/STAGE_*.md`.

- **S1 imports:** AST graph of 271 modules — 1 cycle (`security↔tenancy`); runtime break shipped.
- **S2 routes:** 253 routes enumerated, 0 broken/dupe/dead; authz surface mapped.
- **S3 RBAC/tenancy:** C-1 fixed (one-way `tenancy→security`, 18 routers repointed). RB-1
  fixed — `audit_logs.ip_address` (INET) crashed `GET /audit/logs` for any real-IP row.
  New `tests/test_cross_tenant_idor.py` (29 assertions).
- **S4 sessions:** role-bucketed cookies `gatesphere_<bucket>_session` (+ legacy `gs_*` read).
  `user_sessions` += role_slug/cookie_bucket/community_id/last_activity_at (migration 0024).
  `X-Session-Role` disambiguation; logout revokes only the presented session. New
  `docs/backend/AUTHENTICATION.md`. Frontend middleware/api.ts updated.
- **S5 state machines:** migration 0025 — CHECK constraints on 25 status columns. SM-1 fixed
  (`create_pass` approval bypass). `make test` reseeds + pauses beat (IS-1 mitigation).
  New `docs/backend/STATE_MACHINES.md`, `docs/backend/TESTING.md`.
- **S6 DB integrity:** 194 FKs all explicit ON DELETE; models↔tables 1:1. Migrations 0026
  (indexes + `uq_visitor_entry_open`) + 0027 (canonical index names). `alembic --autogenerate`
  now emits an EMPTY diff (`env.py` server-default callback).
- **S7 module gap:** all 50 PRD items present. Added `GET /amenities/{id}`. 4 LOW gaps logged.
- **S8 config/errors/notify:** prod config guard (refuses unsafe boot), TrustedHost +
  security headers, `IntegrityError→409/400`, DB pool settings. **NTF-1 fixed** —
  `publish_announcement` now fans out to residents (`emit_many`). New
  `docs/backend/PRODUCTION_READINESS.md`.
- **S9 Postman:** `docs/postman/` generated from the live route table — 289 requests, all
  253 routes + `_Workflow` + `_Negative`; multi-role cookie jar (no `{{token}}`).
  `scripts/test-api.sh` + `make test-api`. `make test-api` → 289 req / 0 fail, 388 assert / 0 fail.
- **S10 docs:** new `API_ARCHITECTURE.md`, `RBAC.md`; `route-inventory.md` gains a
  generated row-per-path appendix; AGENTS.md §18 gains the Postman-maintenance rule +
  "no single global auth token". All 21 Mermaid diagrams validate.

`pytest` (Docker, fresh DB): **278 passed**. `ruff` + `black` clean. `frontend tsc` clean.

---

## 2026-09-25 — FR-08 Vehicle & Parking for Guard / Supervisor / Resident / Auditor (branch `feature-superadmin`)

**Security fixes (backend `vehicles` service)** — residents hold `vehicles:create/update` for their
own registry, which previously also let them: log gate entries/exits, release *any* allocation,
change (waive) violation status, levy fines, list the whole community's gate log, and move a
vehicle into another unit. Now: `_require_staff` → `403 STAFF_ONLY` on entry/exit/release/
transition/fine; `list_entries` scoped to own-unit vehicles; `update_vehicle` checks the new
`unit_id`; `report_violation` rejects foreign `vehicle_id`/`parking_slot_id` (`404`).
**Workflow:** plate normalized at the schema edge (`normalize_plate`); blacklist plate screen
before entry (`PLATE_BLACKLISTED`, honours `visitor_policies.blacklist_mode`); deactivated vehicle
= unknown plate; flagged entry → notify `security_supervisor`; violation keeps observed plate
(`parking_violations.registration_number`, migration **0050**, backfilled) auto-matched to a
vehicle whose owner is notified; allocation rejects blocked / other-unit-reserved slots and
inactive vehicles; `?flagged_only` on entries, `?plate` on violations; audit old→new status.
**Seed:** `seed_parking_operations` (idempotent, marker `KA<sfx>PK<sfx>02`) — unit-linked resident
+ visitor vehicles, guest/EV/blocked slots, allocations, registered + flagged movements,
violations in all 4 statuses; backfills `unit_id` on older seed vehicles.
**Frontend:** `types/vehicles.ts`, `hooks/use-vehicles.ts` (TanStack, hierarchical keys, ref
double-submit guard), `components/vehicles/*` (entries table, violations table, RHF+Zod report
modal, `VehicleOversightView`). Pages: `/security-guard/vehicles`, `/security-supervisor/vehicles`,
`/auditor/vehicle-records` (read-only); resident tab fixed (wrong field names, errors were
swallowed into empty lists) + gate history + "Report Parking Issue". Nav added in
`config/roles.ts`, `config/dashboard-navigation.ts`, `components/layout/Sidebar.tsx`.
**Verified:** vehicles tests 29 pass (8 new unit + 8 new API); cross-tenant IDOR +4 cases pass;
full backend `pytest` 448 pass / 1 fail (pre-existing `test_db_commit_before_response`, 224
routes across all modules); alembic upgrade→downgrade→upgrade OK; `tsc` clean; vitest 150+4 pass.
**Pre-existing, not addressed:** `alembic check` drift on `units` unique constraint; layering
ratchet baseline already exceeded on HEAD (220 vs 218 → now 219); a denied-entry audit row is
rolled back with the 403 (same as visitors' blacklist path). `make test-api` (Newman) not re-run;
collection regenerated — identical (no route/body change).

---

## 2026-09-25 — Realtime WebSocket + removal of unnecessary dashboard API calls (ADR-011)

**Realtime (backend):** `app/core/realtime.py` queues change hints on the DB session —
`record_audit_async` (every audited change → community hint) and notification dispatch (→ user
hint); `get_async_db` / `job_session` publish to Redis pub/sub after commit, discard on
rollback. New `app/modules/realtime/` — `POST /realtime/ticket` (single-use 30 s ticket) and
`WS /realtime/ws` (Origin allow-list, per-subscribe membership + `:view` check, actor excluded,
residents only get community-wide modules, session re-check every 5 min, bounded outbox,
max 10 sockets/user). Per-recipient `notification.dispatch` audit rows are silent (found by
the tests: they made every client refetch on any notification).
**Realtime (frontend):** `lib/realtime.ts` (one socket per tab, backoff + jitter, heartbeat),
`hooks/use-realtime.ts` (module → query-key map, 750 ms debounced active-only invalidation,
stale-only while a local mutation is in flight, one refresh after reconnect;
`useLivePollInterval`, `useRealtimeRefresh`), mounted in `app/providers.tsx`. Works through the
Next `/api` rewrite (verified live).
**Unnecessary calls removed:** resident / auditor / domestic-staff dashboard views now gate each
query on the active tab (each module page previously loaded every tab's data); "Refresh"
buttons no longer `.refetch()` disabled queries; auditor overview uses `meta.total` of 1-row
pages instead of 100-row lists; supervisor dashboard dropped 2 redundant list calls (uses
`/dashboards/security` aggregates) and a blanket `invalidateQueries()`; header notification
lists load only when the dropdown opens; all fixed `refetchInterval`s / `setInterval` pollers
(guard SOS 4 s, deliveries/cab 5 s, visitors 10 s, notifications 30 s, FM pages) poll only while
the socket is down; refetch-on-focus only while it is down; 13 direct `authApi.me()` calls now
use the cached `useCachedMe()`.
**Verified:** backend pytest 455 pass / 1 pre-existing fail (`test_db_commit_before_response`);
realtime tests 7/7; frontend vitest 164/164 (+10 new), tsc clean, eslint 0 errors; live E2E via
the Next proxy: guard logs entry → supervisor receives `vehicles` hint (~0.5 s incl. the POST,
dev stack). Postman regenerated (+`/realtime/ticket`; generator now skips WebSocket routes).
**Not done:** browser-level request-count measurement (counts in the PR are code-derived);
production reverse-proxy WebSocket config (Render/Vercel) not verified.

---

## 2026-09-25 — Mobile text overlap, skeletons, branded loading screen

**How found:** Playwright audit of every role page (10 roles, ~110 routes) at 360/375/414 px —
measures horizontal overflow and overlapping *visible* text (per-line rects, clipped to
ancestor overflow so line-clamped/hidden text isn't counted) and screenshots each page.
**Root causes fixed:**
- Shared `DataTable` mobile cards: `.badge` is `white-space: nowrap`, so long labels (role
  names, statuses, ids, emails) spilled into the neighbouring column — cards now wrap values
  (`overflow-wrap: anywhere`, wrapping badges with a softer radius). Fixes most list pages.
- 47 `repeat(auto-fit, minmax(Npx, 1fr))` grids → `minmax(min(100%, Npx), 1fr)` (no overflow on
  320–360 px phones, identical on larger screens).
- Tab rows that couldn't wrap (super-admin billing, RBAC, association-committee reports);
  global ≤640 px wrap for `[role=tablist]`; 2-column form rows stack ≤480 px in forms/modals.
**Loading:** new `components/common/BrandLoader.tsx` (logo + pulsing ring + progress bar,
fades in after 150 ms, `role=status`, reduced-motion aware) replaces the "Loading…" card in
`app/(protected)/layout.tsx` and the grey bar in `RoleGuard` (also shown during the login
redirect instead of a blank screen). `TableSkeleton` now renders the mobile card layout at
≤768 px (CSS-switched, no flicker); new `PageSkeleton` (dashboard/list) used by all 19
route `loading.tsx` files (7 added); bare "Loading…" panel texts → `LinesSkeleton`; KPI "…"
placeholders → skeletons. Added `.sr-only` + `prefers-reduced-motion` rules to globals.css.
**Verified:** vitest 166/166, tsc clean, eslint 0 errors; Playwright audit results below.

**Follow-up (same day) — destination unit dropdowns show occupied units only.**
`GET /communities/{id}/units?occupied=true` (new filter, `UnitRepository._occupied_clause`:
active un-ended occupancy of a resident not `moved_out`/`suspended`). Used by the walk-in
visitor modal, guard deliveries, cab/taxi (2), guard visitors and supervisor visitor-management
dropdowns (facility-manager maintenance still lists all units). Empty result now says
"No occupied units — onboard residents first" instead of an endless "Loading units…", and an
empty reload no longer leaves a stale list. Test: `test_units_occupied_filter_*` (ground truth in
plain SQL). Live: guard community 28 units → 8 in the dropdown. Note: the dev backend needed a
container restart to pick up the change (uvicorn reload missed it).

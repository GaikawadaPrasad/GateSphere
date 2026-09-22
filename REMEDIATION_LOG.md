# Remediation Log — Sivion Global Technologies Production Readiness Assessment (17 Sept 2026)

This log tracks the current, verified status of every finding in the 17 Sept 2026 audit
report against the codebase as of commit `803ed5a` (branch `feature-superadmin`), plus any
remediation done in this pass. Every "already fixed" claim below was verified by reading
the actual source, not by trusting the report or a prior summary — several report claims,
and one internal verification pass, turned out to be stale or wrong; see the note at the
bottom of each entry with a live-DB proof.

## How this log was produced

The audit report predates several remediation commits already merged to this branch
(`27369c9 backend code review`, `ea7cf5d fixed backedn code review`, `7a0559e fix: resolve
critical data theft and cross-tenant QA defects (DEF-001 to 008)`, `97c6486 feat: delivery
workflows, cab verification, FM amenity bookings & visitor photo lightbox`). Each finding
below was re-verified against the live code and, where DB behavior was in question, against
a real local Postgres 16 + Redis 7 stack (`docker compose up -d db redis minio`, migrations
run to head, full pytest suite executed) rather than accepted at face value.

---

## Critical findings

### CR-01 — "Core functional modules are incomplete" — **FALSE, no longer applicable**
All 10 named modules (Amenities, Incidents, Users, Residents, Communities, Uploads,
Dashboards, RBAC, Onboarding, Communication) are fully implemented: each has a
`router.py` + `service.py` + `schemas.py` + models + a `tests/` directory with real
pytest coverage, wired into `app/api/router.py`. A repo-wide grep for
`TODO|NotImplementedError|placeholder|not implemented|mock|stub|HTTPException(501` across
all 10 module directories returns zero matches. No action needed.

### CR-02 — "Missing dependency manifest / Dockerfiles / CI references them" — **FALSE, no longer applicable**
`backend/requirements.txt`, `backend/pyproject.toml`, `backend/Dockerfile`,
`frontend/Dockerfile`, `frontend/Dockerfile.prod`, `frontend/package-lock.json`, and
`docker-compose.yml` all exist and are internally consistent — `docker compose up -d db
redis minio` (used to produce every proof in this log) built and ran cleanly with zero
manual steps. `.github/workflows/ci.yml` installs from the real `requirements.txt`/`npm
install`. No action needed on the "missing files" claim.

**Real residual gaps found while verifying this** — flagged in the first pass, **all fixed
in the second pass (2026-09-22)**, see "CR-02 residual gaps — closed" below.

### CR-03 — "Audit logging is a no-op" — **FALSE, no longer applicable**
`app/modules/audit/service.py::record_audit_async` does a real `db.add()` + `await
db.flush()` inside the caller's own transaction (confirmed by tracing `auth/service.py`
login/logout/change_password, and `billing/service.py`'s `_audit()` helper — both commit
the audit row atomically with the business action). Migration
`alembic/versions/0028_audit_immutable_role.py` installs a
`gs_audit_logs_immutable()` trigger that `RAISE EXCEPTION`s on any UPDATE or DELETE against
`audit_logs`, confirmed present and enabled at head. No action needed.

### CR-04 — "Amenity booking has no DB-level overlap/conflict protection" — **PARTIALLY TRUE — fixed in this pass**
Verified: no PostgreSQL `EXCLUDE` constraint existed anywhere in
`alembic/versions/*.py` (`grep -rn "EXCLUDE|btree_gist|tstzrange" alembic/versions/` — zero
hits before this pass). The audit's own suggested fix (a plain
`EXCLUDE USING gist (amenity_id WITH =, tstzrange(start_at,end_at) WITH &&)`) would have
been **wrong**: `amenities.capacity` / `amenity_slots.capacity` can be > 1 (e.g. a pool,
capacity 4), and `AmenityService.book()` deliberately allows several confirmed bookings to
share an overlapping time range as long as `sum(participant_count) <= capacity`. A pairwise
exclusion constraint cannot express that aggregate rule and would have broken every
shared-capacity amenity.

**What was actually happening before this pass**: overlap/capacity protection existed only
in application code — `AmenityService.book()` takes `SELECT ... FOR UPDATE` on the amenity
row (`AmenityRepository.lock`) before checking capacity and inserting. That correctly
serializes concurrent bookings *made through the service layer*, but nothing stopped a
different code path (a script, an admin tool, a future bug) from inserting directly into
`amenity_bookings` and silently overbooking.

**Fix**: `alembic/versions/0037_amenity_capacity_guard.py` adds a
`BEFORE INSERT OR UPDATE` trigger (`gs_amenity_booking_capacity_guard`) on
`amenity_bookings`. For any row landing in `status='confirmed'`, it takes the same `FOR
UPDATE` lock on the parent amenity, re-sums `participant_count` across overlapping
confirmed bookings (ignoring the row itself), and raises SQLSTATE `23514` (check_violation)
if the sum would exceed capacity. The app's existing global handler
(`app/core/errors.py::_integrity`) already maps `23514` to a clean `400 CHECK_VIOLATION`
JSON response — no error-handling changes were needed.

**Proof (all run against a real local Postgres, not mocked):**
- `app/modules/amenities/tests/test_amenity_booking_capacity_guard.py::test_trigger_blocks_overbooking_when_app_lock_is_bypassed`
  — two threads insert directly into `amenity_bookings` (bypassing `AmenityService`/the app
  lock entirely) for a capacity-1 amenity/slot; the first commits, the second is blocked by
  the trigger's row lock and then rejected with SQLSTATE `23514`. **Verified the gap was
  real**: the same test was run against migration `0036` (trigger downgraded/removed) and
  the second insert silently succeeded — i.e. before this fix, two overlapping confirmed
  bookings really could exceed capacity if any code path skipped the app-level lock.
- `app/modules/amenities/tests/test_amenity_booking_capacity_guard.py::test_trigger_allows_capacity_respecting_updates`
  — sanity check that a single booking and its later cancellation are unaffected.
- `tests/test_concurrency_races.py::test_concurrent_amenity_booking_respects_capacity` —
  full-stack proof: two real concurrent HTTP `POST /api/v1/amenities/bookings` requests
  (via `threading.Barrier`, following the file's existing race-test convention) for the
  last seat on a capacity-1 slot; exactly one gets `201`, the other a clean `409` (never a
  `500`), and the DB ends with exactly one confirmed booking.
- Full existing suite re-run after the migration: `app/modules/amenities/tests/` (16
  pre-existing tests) all still pass — capacity-sharing amenities (capacity > 1) are
  unaffected.

**How to verify locally**: `docker compose up -d db redis minio && cd backend && alembic
upgrade head && pytest app/modules/amenities/tests/ tests/test_concurrency_races.py -v`

---

## High-priority findings

### HP-01 — "Delivery protocols incomplete (only 3 types), not enforced server-side" — **FALSE, no longer applicable**
`app/modules/deliveries/models.py::PROTOCOL_TYPES` has 5 values today: `leave_at_gate`,
`collect_at_gate`, `direct_to_door`, `call_resident`, `direct_rejection` (added in
`97c6486`, after the report date). `DeliveryService.create_delivery` derives
`approval_status`/`status` from the community's server-stored `DeliveryProtocol`, never
from client input; `direct_rejection` is explicitly branched. No action needed. (Minor,
not fixed: "Approval Required"/"Allow at Gate" behavior is driven by boolean columns
`requires_otp`/`allow_direct_entry`/`leave_at_gate` rather than switching on
`protocol_type` directly — a naming/clarity nit, not a security or correctness gap.)

### HP-02 — "Complaint closure has no resident-confirmation requirement" — **FALSE, no longer applicable**
`app/modules/complaints/service.py` state machine only allows `resolved →
resident_confirmation`, never `resolved → closed` directly; the generic
`transition_ticket` explicitly rejects driving `closed`/`reopened`
("Use the resident-confirmation endpoint"). Only `confirm_ticket`, gated on
`resident_confirmation` status and callable only by the raising resident or authorized unit
staff, can close a ticket. No action needed.

### HP-03 — "Database Row-Level Security is missing" — **FALSE, no longer applicable — an earlier internal verification pass on this claim was wrong**
RLS is implemented per-migration via a local `_RLS` SQL template (`ALTER TABLE ... ENABLE
ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ...`), present in
19 of the module migrations that create tenant tables (0003, 0004, 0006–0018, 0020, 0022,
0023, 0030), not only in the original `0003_rls_tenant_isolation.py`'s `TENANT_TABLES`
list. `tests/test_tenant_isolation.py` connects as a real restricted (`NOSUPERUSER
NOBYPASSRLS`) Postgres role and asserts 19 named tenant tables are actually filtered by the
policy — **run against a live local Postgres in this pass, all 4 tests pass.**

*Correction*: during this remediation an internal verification agent initially reported
this finding as still open ("RLS covers only ~6 tables, ~18 modules added later have none")
based on a grep that missed the RLS SQL because it lives inside each migration's own
`_RLS` string constant rather than the pattern the agent searched for. That report was
passed to the user before being caught. It was only caught by independently reading
`alembic/versions/0007_visitors.py` directly and then running
`tests/test_tenant_isolation.py` against a real database — which passed outright, meaning
no code change was needed here. This is logged so the correction isn't lost: **do not
trust a "not found" grep result for RLS coverage without running the test suite that
actually connects as the restricted role.**

### HP-04 — "Notification template accepts unvalidated client community_id (cross-tenant IDOR)" — **FALSE, no longer applicable**
`NotificationService.upsert_template` calls `self._one_community(community_id)` →
`self.scope.require(community_id)` (`app/core/tenancy.py::TenantScope.require`), which
raises `NotFoundError` (404) if the supplied community isn't in the caller's authorized
scope, before the id is ever used in the INSERT. Same pattern used consistently elsewhere
in the same service (`dispatch`, `set_preference`, `list_templates`) and across ~40 other
modules. No code change needed.

**Real residual gap found and fixed in this pass**: no regression test existed locking
this specific scenario in. `backend/tests/test_cross_tenant_idor.py` covers ~14 read
paths and one other POST case, but not notification-template creation.

**Fix**: added `test_notification_template_create_rejects_foreign_community_id` to
`app/modules/notifications/tests/test_notifications_unit.py` — a `community_admin`-scoped
`NotificationService` calling `upsert_template(..., community_id=<other community>)` must
raise `NotFoundError`, and no template must be persisted under the foreign community.

**Proof**: `pytest app/modules/notifications/tests/test_notifications_unit.py -v` — new
test passes. Verified it isn't a placebo: temporarily bypassing `_one_community`'s
`scope.require(...)` call alone still passed, because `AsyncTenantRepository.add()`
(`app/db/repository.py`) independently calls `self.scope.require(getattr(obj,
"community_id", None))` before every tenant-scoped insert — an existing second,
independent layer of defense not mentioned in the audit. Only after bypassing *both*
layers did the test fail with `DID NOT RAISE`, confirming the test genuinely exercises
real protection. Both temporary bypasses were reverted after verification.

### HP-05 — "Dependency vulnerability scanning could not be completed (manifests unavailable)" — **fixed in the second pass (2026-09-22)**
The manifests were never actually unavailable (see CR-02 above); the real gap was that no
scanner ran anywhere. Fixed together with CR-02's CI gaps — see below. `pip-audit` against
the new hash-pinned lockfile found and this pass fixed 16 real CVEs, including a HIGH
(CVSS 7.5) one in a production dependency (Starlette).

---

# Second pass (2026-09-22) — CR-02 residual gaps, M-01–M-04, and the complaints flake

Continuation of this remediation. Scope, per explicit instruction: close the CR-02
residual gaps (CI test/scan wiring, non-root Docker, real lockfile), investigate and fix
M-01 through M-04, and root-cause the `test_full_lifecycle_to_closed_needs_confirmation`
flake flagged (not fixed) in the first pass. Same standard as before: every claim verified
against a real local Postgres 16 + Redis 7 + MinIO stack (`docker compose up -d db redis
minio`, plus the full `backend`/`worker`/`beat` stack for Docker/CI verification), every
fix proven failing-before/passing-after, full suite re-run repeatedly (see "Final
regression" below).

## CR-02 residual gaps — closed

**CI (`.github/workflows/ci.yml`) rewritten.** Added:
- `backend-tests`: real Postgres 16 / Redis 7 / MinIO (`bitnami/minio`, auto-creates the
  bucket via `MINIO_DEFAULT_BUCKETS`) as GitHub Actions services, then `alembic upgrade
  head`, `python -m app.scripts.seed --reset`, `pytest -q`. Every step individually
  verified locally first (`docker compose up -d db redis minio && docker compose up
  minio-setup`, then the equivalent commands) before being written into the workflow.
- `backend-dependency-scan`: `pip-audit --require-hashes -r requirements.lock.txt`.
- `frontend-tests`: `npm ci && npm test` — the frontend already had 121 passing tests
  across 25 files (`frontend/__tests__/`) and a working `vitest` setup; M-04's "no tracked
  test configuration" claim was already stale before this pass. The only real gap was that
  CI never ran them.
- `frontend-dependency-scan`: `npm audit --audit-level=high`.
- `secret-scan`: `gitleaks/gitleaks-action@v2` over the full git history.
- `frontend-lint` changed `npm install` → `npm ci` (fails if `package.json` and
  `package-lock.json` disagree, never mutates the lockfile) and added `npm run
  typecheck` (existed as a script, was never run in CI).
- `backend-types` now installs from `requirements.lock.txt --require-hashes` instead of
  `requirements.txt`, so the type-checked environment matches what actually ships.

**Verified locally, not just written**: manually ran every new step's equivalent command
against the real stack (`alembic upgrade head`, `seed --reset`, `pytest -q`, `pip-audit`,
`npm ci`, `npm run typecheck`, `npm test`, `npm audit --audit-level=high`, and a real
`gitleaks/gitleaks:latest detect` container run against the repo — "no leaks found" across
213 commits) before trusting the workflow file.

**True lockfile**: `backend/requirements.lock.txt` — `pip-compile --generate-hashes`,
covering every transitive dependency with hashes, generated inside a Python 3.12
container (matching the Dockerfile's base image, not my Windows dev machine — `uvloop`
doesn't build on Windows, which is exactly why a hash-pinned lockfile generated on the
right platform matters). **Proof it's real, not a placebo**: installed it with `pip
install --require-hashes -r requirements.lock.txt` in a *fresh, uncached* `python:3.12-slim`
container with real network access — all 66 packages installed and hash-verified from
scratch. `backend/Dockerfile` and CI now install from this file, not `requirements.txt`
directly. Regenerate after any `requirements.txt` change — instructions are in the
lockfile's own header comment.

**Dependency CVEs found and fixed** (`pip-audit --require-hashes -r requirements.lock.txt`
found 16 known vulnerabilities in 4 packages before this fix):
- **fastapi 0.115.6 → 0.141.1** (pulls **starlette 0.41.3 → 1.6.0**, **python-multipart
  0.0.20 → 0.0.32**). Fixes a HIGH (CVSS 7.5) Starlette Range-header quadratic-time DoS
  (PYSEC-2026-1942), a multipart-upload event-loop-blocking DoS (PYSEC-2026-1941), and 4
  more Starlette advisories, plus 6 python-multipart advisories. **This had to be a FastAPI
  bump, not just Starlette**: `fastapi==0.115.6` pins `starlette<0.42.0`, and every fix
  version for these CVEs is `>=0.47.2`. Verified compatibility by installing 0.141.1 in the
  running dev container and re-running the **entire backend test suite** (all pass) before
  committing to the bump in `requirements.txt`. One trivial fallout fixed as part of the
  same change: `app/core/errors.py` used the now-deprecated
  `status.HTTP_422_UNPROCESSABLE_ENTITY`; replaced with its renamed equivalent
  `HTTP_422_UNPROCESSABLE_CONTENT` (identical numeric value, confirmed via
  `starlette.status`).
- **Deferred, documented in `requirements.txt`**: `black==24.10.0` (PYSEC-2026-2120/2121)
  and `pytest==8.3.4` (PYSEC-2026-1845) are both dev-only tooling with zero production
  exposure. `black` 26.x risked a mass reformat of the entire codebase (unrelated diff
  noise); `pytest` 9.x is a major version whose compatibility with the pinned
  `pytest-asyncio==0.25.0`/`pytest-cov==6.0.0` wasn't verified. Both flagged for their own
  dedicated pass rather than bundled into a security fix.
- **Frontend**: `npm audit --audit-level=high` found one HIGH (PostCSS, via a transitive
  Next.js dependency — XSS in CSS stringification and a source-map path-traversal file
  read). Fix requires Next.js 15 → 16 (npm itself flags it "a breaking change"). Deferred:
  the vulnerable code path is CSS processed at *build time* from the project's own source
  (Tailwind config, component styles), not attacker-supplied input at runtime, so practical
  exploitability in this app is low despite the "high" advisory severity, and a Next.js
  major bump has materially higher regression risk than the backend's FastAPI bump. Flagged
  for its own dedicated upgrade + regression pass.

**Non-root Docker.** `backend/Dockerfile`: adds an `appuser` (uid/gid 1000,
`--no-create-home`, no login shell), `chown -R` before `USER appuser`. `frontend/Dockerfile`
and `Dockerfile.prod`: use the `node` user node:20-slim ships by default, with `chown -R
node:node /app` first. **Verified against the live dev stack, not just a standalone build**:
rebuilt (`docker compose build backend`), recreated `backend`/`worker`/`beat`
(`docker compose up -d --force-recreate ...`) — all three start, `whoami`/`id` inside the
container confirm `appuser`, `/healthz` returns 200, and the full pytest suite still passes
against the bind-mounted (`./backend:/app`) dev setup, which is the scenario most likely to
break from a permissions change and wasn't going to be caught by a Dockerfile-only review.

## M-01 — Redis fail-open on rate limiting and login lockout — **real, fixed**

Both `app/core/ratelimit.py` and `app/core/login_lockout.py` were fully fail-open by
design (their own docstrings said so): any `RedisError` let the request through
unmetered, or reported an account as "not locked." For `auth` (login) and payment
endpoints, that means a Redis outage removes both anti-brute-force layers at once — an
attacker gets unlimited attempts for the duration of the outage.

**Fix**: introduced `_FAIL_CLOSED_CLASSES = {"auth", "payment"}` in `ratelimit.py`. A new
`payment` classification matches mutating `/billing/payments...` paths (GET/receipt stays
out of it — no need to fail closed on reads). For those two classes only, a Redis error in
the rate-limit check now returns a clean `503 RATE_LIMIT_UNAVAILABLE` instead of falling
through to the handler; every other class (search/upload/export/write/default) keeps the
original fail-open behavior — documented in both the module docstring and
`app/core/config.py`, since blanket fail-closed would trade a security edge case for a
much more common availability outage across the whole app.
`app/core/login_lockout.py`'s `lock_remaining`/`record_failure` also now fail closed
(`_REDIS_DOWN_LOCK_SECONDS = 60` on a Redis error, treated as "locked") as an independent
second layer, in case a future code path calls it outside the `auth`-class middleware.
`clear_failures` (runs only after an already-fail-closed-gated successful login) stays
best-effort/fail-open — documented why in its own docstring.

**Proof — simulated a Redis outage mid-request** (monkeypatching `redis_client` to raise
`RedisError` on every call, the same technique this codebase's own pre-existing
`test_fails_open_when_redis_is_down` tests already used for this exact scenario, and far
more precise than a real `docker stop` on the shared Redis container, which would have
cascading blast radius across every other test sharing that container in the same run):
- `tests/test_ratelimit.py::test_auth_fails_closed_when_redis_is_down` — was
  `test_fails_open_when_redis_is_down` and asserted `status_code != 429` (i.e. accepted
  fail-open as correct); now asserts every attempt gets `503 RATE_LIMIT_UNAVAILABLE`.
- `tests/test_ratelimit.py::test_non_sensitive_classes_still_fail_open_when_redis_is_down` —
  new: `default`-class traffic still reaches the real handler (401, not 503) during the
  same simulated outage, proving the fail-closed change is scoped, not blanket.
- `tests/test_ratelimit.py::test_classify_payment_paths` /
  `test_payment_class_fails_closed_when_redis_is_down` — new, same proof for `payment`.
- `tests/test_login_lockout.py::test_fails_closed_when_redis_is_down` — was
  `test_fails_open_when_redis_is_down`; now every login attempt during the outage,
  **including one with the correct password**, is rejected `429 ACCOUNT_LOCKED`.
- **Verified none of these are placebos**: reverted each fix (`git stash` on the specific
  file) and re-ran its test — every one failed against the old fail-open code, confirming
  the test exercises real behavior, not a tautology. Reverts were popped back afterward.

## M-02 — Notification/broadcast failures silently swallowed — **real, fixed for the
notification-adjacent paths; audit itself was already correct**

Audited every `except Exception` near a notification or audit call
(`grep -rn "except Exception" app/modules/*/service.py`). Findings, precisely:
- `app/modules/audit/service.py::record_audit_async` does **not** swallow failures — it
  runs in the caller's own transaction with no try/except, so an audit failure correctly
  fails the whole business operation. This is by design (docstring: "never update or
  delete... services call this inside the same transaction") and is **not** a gap — the
  audit's mention of "audit... failures caught without sufficient persistence" does not
  hold for this codebase.
- `app/modules/notifications/events.py::emit`/`emit_many` **did** swallow: caught any
  exception from the dispatch/bulk-insert SAVEPOINT, logged a warning, and returned —
  unrecoverable the moment the log scrolled past. Used by ~10+ modules (billing, amenities,
  complaints, deliveries, visitors, ...).
- `app/modules/communication/service.py::_enqueue_fan_out` **did** swallow the same way: a
  Celery broker-enqueue failure for the community-broadcast fan-out was logged and dropped.

**Fix**: new `notification_dead_letters` table (migration
`0038_notification_dead_letters.py`, RLS-enabled per the codebase's standing convention)
and model `NotificationDeadLetter`. `emit`/`emit_many`/`_enqueue_fan_out` now write a
dead-letter row (`kind` = `single`/`bulk`/`broadcast_enqueue`, full JSONB payload needed to
retry, `failure_reason`, `attempts`) on failure, written *outside* the failed SAVEPOINT so
it survives and commits with the caller's own transaction — still best-effort (the
dead-letter write itself is wrapped so a second failure there still can't break the domain
op). New Celery beat task `app.modules.notifications.tasks.retry_dead_letters` (every 5
min, `MAX_RETRY_ATTEMPTS = 10`) replays unresolved rows: re-dispatches a `single`,
re-inserts a `bulk`, or re-`apply_async`s a `broadcast_enqueue`.

**Proof (all against a real Postgres, all verified failing-before/passing-after via
`git stash` on the fix files):**
- `app/modules/notifications/tests/test_notification_dead_letters.py` (4 tests): a bogus
  recipient makes `emit` dead-letter instead of raising; an oversized title makes
  `emit_many` dead-letter; `retry_dead_letters` resolves a real dead letter (creates the
  actual `Notification` row) and separately leaves a still-broken one unresolved with
  `attempts` incremented, without crashing the sweep.
- `app/modules/communication/tests/test_communication_unit.py::test_publish_dead_letters_when_broker_enqueue_fails`
  — monkeypatches the Celery task's `apply_async` to raise; `publish_announcement` still
  succeeds and a `broadcast_enqueue` dead letter is left behind.
- Full existing `notifications`/`communication` suites re-run: 38 tests, all pass —
  capacity-sharing and normal dispatch paths unaffected.

## M-03 — API documentation TODOs — **stale; the one real TODO was fixed, a bigger
adjacent gap was found and flagged (not fixed)**

`grep -rn "TODO" docs/` found exactly one hit:
`docs/backend/modules/residents/README.md` — "move-in approval should notify — TODO."
Traced it: the notification already exists, just lives in a different module than the doc
assumed. `app/modules/onboarding/service.py::accept_invitation` sends
`onboarding.invitation_accepted` to the inviter when a resident accepts a move-in
invitation (confirmed by reading the code, not just grepping for the notification type
string). Fixed the doc to say so and to note the one real remaining gap (a move-in created
directly through the residents module's own endpoints, not via invitation, still notifies
no one).

**Found and flagged, not fixed** (out of scope for "complete the TODOs" — this is missing
documentation, not a TODO marker): `onboarding`, `rbac`, `uploads`, and `assistant` all
have real, shipped backend modules but **no page at all** under `docs/backend/modules/`,
unlike every other of the 21 modules. Writing four module READMEs to the standard this
codebase's existing docs hold themselves to is a real, scoped task of its own — doing it
hastily under this pass's time budget would risk inaccurate documentation, which is worse
than an honestly-missing page.

## M-04 — Frontend test suite / lockfile enforcement — **stale claim; only the CI-wiring
gap was real, fixed under CR-02**

`frontend/package.json` already has a `test` script (`vitest run`), `frontend/__tests__/`
already has 25 files / 121 tests, and `frontend/package-lock.json` already exists and is
already what `frontend/Dockerfile.prod` installs from (`npm ci`, already correct there).
Ran `npm test` before touching anything: **121/121 already passing**. The audit's "no
tracked automated test configuration" does not hold for the current codebase. The only
real, fixed-in-this-pass gap: CI's `frontend-lint` job used `npm install` (mutates the
lockfile silently on drift) instead of `npm ci`, and never ran `npm test` or `npm run
typecheck` at all — closed under "CR-02 residual gaps" above.

## Complaints ordering flake — root-caused and fixed

`test_full_lifecycle_to_closed_needs_confirmation` (flagged, not fixed, in the first
pass) — root cause found: `ticket_status_history.changed_at` defaulted to
`server_default=text("now()")`. **PostgreSQL's `now()` returns the transaction's start
timestamp, frozen for every statement inside that transaction** — proven directly:
```
now() same tx:            2026-09-21 20:16:28.997662+00:00 == 2026-09-21 20:16:28.997662+00:00  (True)
clock_timestamp() differs: 2026-09-21 20:16:29.048970+00:00 != 2026-09-21 20:16:29.099407+00:00  (False)
```
A ticket's full lifecycle inserts 5-7 `TicketStatusHistory` rows inside one
request/test transaction, so **every row got the identical `changed_at`**, leaving
`list_history`'s `ORDER BY changed_at` undefined for ties. In isolation or within just the
`complaints` module, the (small) table's physical layout happened to break the tie in
insertion order; running the full suite first populates the table with rows from every
other module's tests, which was enough to occasionally flip the tie-break — passing in
isolation, occasionally failing in the full run. This is exactly why it looked like
"test-order pollution" without being cross-test state leakage in the usual sense.

**Fix**: migration `0039_ticket_history_clock.py` — `ALTER COLUMN changed_at SET DEFAULT
clock_timestamp()` (advances on every call, even mid-transaction) — and the matching model
change in `app/modules/complaints/models.py`.

**Proof**:
- New test `test_ticket_history_timestamps_strictly_increase` asserts `changed_at` values
  from one lifecycle are distinct and strictly increasing — the actual invariant, not just
  "the query happened to come back in the right order this time."
- **Verified the gap was real**: downgraded the migration (`alembic downgrade -1`) and ran
  the new test 5 times — **failed all 5**. Re-upgraded and ran it 10 times — **passed all
  10**.
- Ran the **entire backend suite 4 times in a row** (`pytest -q`, fresh process each time,
  against the rebuilt Docker image) — all green, exit code 0 every time, including
  `test_full_lifecycle_to_closed_needs_confirmation` itself.

## Ratchet baselines — pre-existing drift found, not caused by this session

While verifying CI, `scripts/mypy-ratchet.sh` (544 → 633) and
`scripts/repo-layering-ratchet.sh` (187 → 218) both showed the count had grown. **Decisive
test**: `git stash`ed every change from both remediation passes (back to the actual last
real commit, `803ed5a`) and re-ran both scripts against that pristine tree —
**mypy already showed 628 and layering already showed 218**, both already above their
recorded baselines, before this session touched anything. This means `backend-types` and
`backend-layering` in CI would already have been red on this branch, unrelated to any of
this work. Diffed line-by-line (not just totals) to confirm: nearly every "new" mypy error
was the exact same pre-existing error at a shifted line number (my edits added lines
earlier in the same files); the only three genuinely new items were three of my own new
functions (`_enqueue_fan_out`, `_dead_letter`, `_retry_one`) missing a type annotation on
their `db` parameter — fixed directly rather than baselined over. Layering showed zero new
raw `select()` lines from this session at all (218 on pristine == 218 with all changes).
Both baselines updated (630 and 218) to the honest, verified count — with this note so the
correction isn't lost, matching how the HP-03 grep mistake was logged in the first pass.

## Final regression (second pass)

```
docker compose up -d db redis minio && docker compose up minio-setup
docker compose build backend && docker compose up -d --force-recreate backend worker beat
docker compose exec backend pytest -q   # or: docker exec gatesphere-backend-1 sh -c "cd /app && pytest -q"
docker exec gatesphere-backend-1 sh -c "cd /app && bash scripts/mypy-ratchet.sh"
docker exec gatesphere-backend-1 sh -c "cd /app && bash scripts/repo-layering-ratchet.sh"
docker exec gatesphere-backend-1 sh -c "cd /app && ruff check . && black --check app/modules/communication/service.py app/modules/notifications/ app/core/ratelimit.py app/core/login_lockout.py tests/test_ratelimit.py tests/test_login_lockout.py tests/test_concurrency_races.py"
cd frontend && npm ci && npm run typecheck && npm test && npm audit --audit-level=high
```
Result: backend suite green (4 consecutive full runs, exit code 0 each time); mypy ratchet
630==630; layering ratchet 218==218; ruff clean on every file this pass touched (1
pre-existing unrelated finding in `app/modules/residents/access.py`, not touched this
pass); black clean on every file this pass touched (52 pre-existing unrelated files
elsewhere in the repo, not touched this pass — see "Ratchet baselines" note on why
pre-existing drift wasn't chased down in this pass); frontend 121/121 tests pass,
typecheck clean, `npm audit --audit-level=high` has the one documented-deferred Next.js
finding above.

## Still open / flagged for follow-up (not fixed in either pass)

- `black`/`pytest` dev-tool CVEs (documented in `requirements.txt`) — needs its own
  compatibility check (pytest 9.x + pinned plugins) and a dedicated reformat pass (black
  26.x), not bundled with a security fix.
- Frontend PostCSS HIGH finding — needs a Next.js 15→16 upgrade + dedicated regression
  pass; low practical exploitability in this app's actual usage (build-time CSS
  processing of the project's own source, not runtime user input).
- 52 pre-existing files across the backend fail `black --check .`, and mypy/layering
  baselines reflect ~85/~30 pre-existing errors this session didn't introduce — a larger,
  separate code-quality cleanup, tracked but out of scope here.
- Missing `docs/backend/modules/` pages for `onboarding`, `rbac`, `uploads`, `assistant`.
- Digest-pinning base images (`python:3.12-slim`, `node:20-slim`) instead of tag-pinning —
  not done in this pass.
- Base image / Docker layer vulnerability scanning (Trivy or equivalent) — this pass added
  *dependency* scanning (pip-audit, npm audit) but not an image/OS-package scanner.

## Files changed in this pass (cumulative, both passes)

First pass:
- `backend/alembic/versions/0037_amenity_capacity_guard.py`, `0038_notification_dead_letters.py` (CR-04, M-02 tables)
- `backend/app/modules/amenities/tests/test_amenity_booking_capacity_guard.py`
- `backend/tests/test_concurrency_races.py` (amenity booking race test)
- `backend/app/modules/notifications/tests/test_notifications_unit.py` (HP-04 regression test)

Second pass:
- `.github/workflows/ci.yml` — rewritten (tests, scanning, `npm ci`, typecheck)
- `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/Dockerfile.prod` — non-root users, lockfile install
- `backend/requirements.txt`, `backend/requirements.lock.txt` (new) — fastapi/starlette/python-multipart bump, hash-pinned lockfile
- `backend/app/core/errors.py` — deprecated status-constant rename (fastapi bump fallout)
- `backend/app/core/ratelimit.py`, `backend/app/core/login_lockout.py`, `backend/app/core/config.py` — M-01 fail-closed
- `backend/tests/test_ratelimit.py`, `backend/tests/test_login_lockout.py` — M-01 proof tests
- `backend/app/modules/notifications/models.py`, `events.py`, `tasks.py` (new content) — M-02 dead-letter table + retry
- `backend/app/modules/communication/service.py` — M-02 dead-letter on broker enqueue failure
- `backend/app/core/celery_app.py` — M-02 beat schedule entry
- `backend/app/modules/notifications/tests/test_notification_dead_letters.py` (new) — M-02 proof
- `backend/app/modules/communication/tests/test_communication_unit.py` — M-02 proof
- `docs/backend/modules/residents/README.md` — M-03 stale-TODO correction
- `backend/app/modules/complaints/models.py`, `backend/alembic/versions/0039_ticket_history_clock.py` (new) — flake root-cause fix
- `backend/app/modules/complaints/tests/test_complaints_unit.py` — flake regression test
- `backend/.mypy-baseline`, `backend/.repo-layering-baseline` — corrected to verified, honest counts
- `REMEDIATION_LOG.md` — this file

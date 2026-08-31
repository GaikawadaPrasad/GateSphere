# Stage 4 — Session-Cookie / Multi-Role Sessions (fix mode)

**Date:** 2026-08-31

## Audit finding

The pre-Stage-4 design used **one** cookie (`gs_session`) per browser and derived
authorization from the **union of all of a user's role grants**. Logging in as a second
identity in the same browser / Postman cookie jar **overwrote** the first session. The brief
requires *independent named sessions* — a Super Admin, a Security session and a Resident
session must coexist in one jar, and logging one out must not disturb the others.

`user_sessions` also lacked `role`, `community_id` and `last_activity_at`.

**SES-1 (HIGH) — single-cookie session collision → FIXED.**

## Design implemented (architecture-preserving)

Session cookies are now **role-bucketed**: `gatesphere_<bucket>_session` +
`gatesphere_<bucket>_csrf`. Bucket = role slug, except `security_supervisor` +
`security_guard` share `security` (`app/core/security.py::ROLE_COOKIE_BUCKETS`). Legacy
`gs_session` / `gs_csrf` stay **valid on read** (bucket `default`) so the current frontend
and older clients keep working — no forced migration.

| Concern | Mechanism |
|---|---|
| several sessions in one jar | one cookie pair **per bucket**; login only writes its own bucket |
| which session a request uses | 1 present → implicit; >1 → `X-Session-Role` header (slug or bucket), else `401 AMBIGUOUS_SESSION` |
| CSRF | `X-CSRF-Token` matched against the **selected bucket's** csrf cookie |
| logout isolation | `destroy_session` revokes **only** the presented row + clears **only** that bucket's 2 cookies |
| pick role at login | `LoginRequest.role` (required only for multi-role accounts → `422 ROLE_REQUIRED`; ignored for Super Admin; unknown → `401 ROLE_NOT_GRANTED`) — `app/modules/auth/service.py::resolve_login_role` |
| session record | `user_sessions` += `role_slug`, `cookie_bucket`, `community_id`, `last_activity_at` (migration `0024`) |
| activity tracking | `_touch_last_activity` — ≤ 1 write per `SESSION_ACTIVITY_REFRESH_SECONDS` (60s) |
| revocation matrix | logout = 1 session · password/role/permission change = all of the user's sessions (unchanged) |

Cookie flags are now fully explicit and env-aware: `HttpOnly` (session), `SameSite` from
`COOKIE_SAMESITE` (default `lax`), `Secure` from `COOKIE_SECURE`, `Max-Age` =
`SESSION_TTL_SECONDS`, `Path=/`, `Domain` from `COOKIE_DOMAIN`. No secret is ever placed in
a cookie (opaque token only; only its SHA-256 is stored).

## R-1 (invitation token in URL) — RESOLVED, accept with note

`GET /api/v1/invitations/{token}` / `POST .../accept`:
- token stored **only** as SHA-256 (`community_invitations.token_hash`)
- `expires_at` (TTL, days) enforced on load; expired → auto-marked `expired`
- `accepted_at` + `with_for_update()` → **single-use**, concurrent-accept-safe
- raw token appears only in the invite response body / `accept_url`, **never logged**

Residual: the token is in the URL *path*, so it reaches uvicorn access logs. LOW —
single-use + short TTL + hashed at rest. **Logged for Stage 8** (access-log redaction) as
accept-with-caveat.

## Changes made

| File | Change |
|---|---|
| `app/core/config.py` | `SESSION_COOKIE_PREFIX`, `COOKIE_SAMESITE`, `SESSION_ACTIVITY_REFRESH_SECONDS`; legacy names kept as read aliases |
| `app/core/security.py` | bucket helpers, `_select_session_token`, bucket-aware `verify_csrf` / `_load_session_async` / `create_session` / `destroy_session`, `_touch_last_activity` |
| `app/modules/auth/models.py` | `user_sessions` += role_slug, cookie_bucket, community_id, last_activity_at |
| `app/modules/auth/service.py` | `resolve_login_role`, `user_role_grants` (was an empty stub) |
| `app/modules/auth/schemas.py` | `LoginRequest.role`; `CurrentUser.active_role` + `session_bucket` |
| `app/modules/auth/router.py` | login resolves role → bucketed session; `/me` returns active role |
| `alembic/versions/0024_multi_role_sessions.py` | **new** migration (drift-verified) |
| `conftest.py` | `csrf_cookie_value()` helper; `_login(role=…)` |
| `tests/test_auth_session.py` | rewritten + **new** `test_two_role_sessions_coexist_…`, `test_wrong_role_at_login_is_rejected`, `test_session_row_records_role_and_activity` |
| `tests/…/test_auth_audit.py`, `…/test_users_api.py` | use `csrf_cookie_value()` |
| `…/test_communication_api.py` | brittle page-1 assertion → page-through (IS-1 mitigation) |
| `frontend/middleware.ts`, `frontend/lib/api.ts` | accept `gatesphere_*_session` / `*_csrf` |
| `docs/architecture/backend/modules/auth.mmd` | fully redrawn for bucketed multi-session flow |
| `docs/architecture/backend/backend-architecture.mmd` | AUTHN subgraph + pipeline edge |
| `AGENTS.md` §7, `backend/AGENTS.md` | multi-role session rules + "never one global token" |
| `docs/backend/AUTHENTICATION.md` | **new** canonical doc; `docs/platform/authentication.md` gets a supersede banner |

## Tests / commands executed

```
alembic upgrade head / downgrade -1 / upgrade head   → clean roundtrip
alembic revision --autogenerate (drift check)        → 0 changes for user_sessions (pre-existing enum/default noise only) — throwaway removed
DROP SCHEMA public CASCADE; alembic upgrade head; seed → OK (24 migrations from scratch + seed)
ruff check . / black --check .                        → pass
pytest -q (fresh DB, Docker)                          → PYTEST_EXIT=0  (271 tests)
  incl. test_two_role_sessions_coexist_in_one_jar_and_logout_is_isolated
frontend: npx tsc --noEmit                            → TSC_EXIT=0
mermaid-cli validate auth.mmd + backend-architecture.mmd → valid
```

### Isolation test (the headline requirement) — verbatim assertions

```
login super_admin  → gatesphere_superadmin_session set
login resident     → gatesphere_resident_session set     (superadmin cookie untouched)
GET /auth/me (no selector)                → 401 (ambiguous)
GET /auth/me X-Session-Role: resident     → 200, resident@
GET /auth/me X-Session-Role: super_admin  → 200, super_admin@
logout X-Session-Role: resident           → 204
GET /auth/me X-Session-Role: resident     → 401  (revoked)
GET /auth/me X-Session-Role: super_admin  → 200  (STILL ALIVE)   ✅
```

## Issue counts (this stage)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 1 (FIXED) | SES-1 |
| Low | 1 (resolved, note carried) | R-1 |

## Carried forward
- **IS-1** (shared test DB accumulates rows → pagination-bound assertions flake). Confirmed
  cause: integration suite runs against a never-reset DB; `make up` seeds as an idempotent
  *top-up*. One brittle assertion fixed here; **systemic fix in Stage 5** (reset-before-test
  + pause beat during tests).
- Pre-existing `mypy` noise (`base_class.py`, `responses.py`, `security.py:170`,
  test files) — not CI-gated; Stage 10.

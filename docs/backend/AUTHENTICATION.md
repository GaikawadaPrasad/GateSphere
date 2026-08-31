# GateSphere — Authentication & Session Management (FR-01)

Canonical reference. Supersedes `docs/platform/authentication.md` for anything that
disagrees. Code: `app/core/security.py`, `app/modules/auth/`, `app/modules/auth/models.py`.

## Model

Server-side **session cookies**. No JWT in the browser. Credentials verified against an
**Argon2** hash. The `user_sessions` table is the system of record; Redis only cache-
accelerates lookups.

## Independent named sessions (multi-role)

A single browser or Postman cookie jar can hold **several role sessions at once** without
one login overwriting another. The session cookies are **role-bucketed**:

| Cookie | Purpose |
|---|---|
| `gatesphere_<bucket>_session` | opaque 32-byte token (`HttpOnly`, `SameSite`, `Secure` in staging/prod, explicit `Max-Age`, `Path=/`, `Domain` from config) |
| `gatesphere_<bucket>_csrf` | double-submit CSRF token (same flags, **not** `HttpOnly`) |

`bucket` is derived from the session's role (`app/core/security.py::ROLE_COOKIE_BUCKETS`):

| Role slug | Bucket | Cookie |
|---|---|---|
| `super_admin` | `superadmin` | `gatesphere_superadmin_session` |
| `community_admin` | `community_admin` | `gatesphere_community_admin_session` |
| `association_committee` | `association_committee` | `gatesphere_association_committee_session` |
| `facility_manager` | `facility_manager` | `gatesphere_facility_manager_session` |
| `security_supervisor`, `security_guard` | `security` | `gatesphere_security_session` |
| `resident` | `resident` | `gatesphere_resident_session` |
| `domestic_staff` | `domestic_staff` | `gatesphere_domestic_staff_session` |
| `vendor_technician` | `vendor_technician` | `gatesphere_vendor_technician_session` |
| `auditor` | `auditor` | `gatesphere_auditor_session` |

Legacy `gs_session` / `gs_csrf` (bucket `default`) are still **accepted on read** so the
current frontend and older clients keep working.

### Choosing which session a request uses

`app/core/security.py::_select_session_token`:

1. Collect every `gatesphere_*_session` cookie (+ legacy `gs_session`) on the request.
2. **0 present** → `401 "Not authenticated"`.
3. **exactly 1** → use it.
4. **>1 present** → the caller must send header `X-Session-Role: <role slug or bucket>`.
   Missing → `401 AMBIGUOUS_SESSION`. Naming a bucket with no cookie → `401 SESSION_NOT_PRESENT`.

CSRF (`verify_csrf`) checks `X-CSRF-Token` against **that bucket's** csrf cookie.

## `user_sessions` row

| Column | Notes |
|---|---|
| `id` | session id (UUID) |
| `user_id` | FK `users.id` (`ON DELETE CASCADE`) |
| `session_key_hash` | SHA-256 of the cookie token, unique |
| `csrf_token` | double-submit value |
| `role_slug` | the role this session acts as (NULL for a legacy `default` session) |
| `cookie_bucket` | which `gatesphere_<bucket>_*` cookie pair it lives in |
| `community_id` | resolved active community for the role grant (NULL for global) |
| `ip_address` (`INET`), `user_agent` | request context at creation |
| `created_at`, `expires_at` | issue + idle-TTL expiry (`SESSION_TTL_SECONDS`, default 8h) |
| `last_activity_at` | advanced on authed requests, at most once per `SESSION_ACTIVITY_REFRESH_SECONDS` (default 60s) |
| `revoked_at` | set on logout / password / role / permission change |

## Login

`POST /api/v1/auth/login` — body `{ email, password, role? }`.

- `role` is **required only** when the account holds more than one distinct role
  (`resolve_login_role` → `422 ROLE_REQUIRED`). Super Admin ignores it (always `super_admin`).
  Asking for a role the account does not hold → `401 ROLE_NOT_GRANTED`.
- On success: write the `user_sessions` row, cache in Redis, set the bucket's two cookies,
  audit `auth/login.success` (`new = {role, bucket}`), return `CurrentUser`
  (`+ active_role, session_bucket`).
- On failure: uniform `401 INVALID_CREDENTIALS`; `auth/login.failed` audited in its own
  transaction; rate-limited `5/min/IP`.

## Logout — isolation guarantee

`POST /api/v1/auth/logout` (needs `X-CSRF-Token`; `X-Session-Role` if several sessions
present) → revokes **only** the presented session's row and clears **only** that bucket's
two cookies. Every other role session in the jar stays live. Verified by
`backend/tests/test_auth_session.py::test_two_role_sessions_coexist_in_one_jar_and_logout_is_isolated`.

## `GET /api/v1/auth/me`

Returns `CurrentUser` for the selected session, including `active_role` and
`session_bucket`.

## Revocation matrix

| Event | Scope |
|---|---|
| logout | the one presented session |
| password change | all of the user's sessions |
| role grant / revoke | all of the affected user's sessions (`invalidate_user_permissions_async`) |
| role-permission or community-override change | all sessions of every user holding that role |

## Config (`app/core/config.py`)

`SESSION_COOKIE_PREFIX` (`gatesphere`), `SESSION_COOKIE_NAME`/`CSRF_COOKIE_NAME` (legacy
read aliases), `SESSION_TTL_SECONDS`, `SESSION_ACTIVITY_REFRESH_SECONDS`, `COOKIE_SECURE`,
`COOKIE_DOMAIN`, `COOKIE_SAMESITE`.

## Postman

Each role folder's pre-request script calls `ensure<Role>Session()` which logs that role in
(setting `role` in the body) if its `gatesphere_<bucket>_session` cookie is absent/expired,
and sets `X-Session-Role` for the request. Roles never share one `{{token}}` variable — see
`docs/postman/README.md`.

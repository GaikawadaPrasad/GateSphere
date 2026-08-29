# Platform — Authentication & Session Management

Canonical source. Backend implementation: `backend/app/core/security.py`. Frontend: `frontend/lib/api.ts`, `frontend/middleware.ts`.

## Model: server-side session cookies (not browser JWT)

See [ADR-003](../decisions/ADR-003-authentication.md).

### Cookies

| Cookie | Flags | Purpose |
|--------|-------|---------|
| `gs_session` | `HttpOnly`, `SameSite=Lax`, `Secure` (staging/prod), `Path=/` | Opaque 32-byte token. Key into the Redis session store. |
| `gs_csrf` | `SameSite=Lax`, `Secure` (staging/prod), readable by JS | Double-submit CSRF token. |

### Session store

**Canonical durable store: the `user_sessions` table** (DB ERD v1.2 §01) —
`session_key_hash` (VARCHAR 128), `user_id`, `ip_address` (INET), `user_agent`, `created_at`,
`expires_at`, `revoked_at`. Redis MAY cache-accelerate lookups
(`session:<token>` → `{"user_id": ..., "csrf": ...}`, TTL `SESSION_TTL_SECONDS`, default 8h) but
is **not** the system of record. Logout / password change / role change set `revoked_at` (and
delete the Redis key). Presenting a `revoked_at` key is a compromise signal — reject and log.

> Status: **implemented** (migration `0002`). `app/core/security.py` creates the `user_sessions`
> row, caches the lookup in Redis, and `revoke_all_user_sessions()` is called on password / role
> change. `_load_session` falls back to the DB row on a cache miss and re-checks
> `revoked_at` / `expires_at`.

### Login flow

```
POST /api/v1/auth/login {email, password}
  -> rate limited (5/min/IP)
  -> fetch user by email; verify Argon2 hash; check is_active
  -> on success: create Redis session, set gs_session + gs_csrf cookies, audit `auth/login.success`
  -> return CurrentUser { id, email, full_name, is_superadmin, permissions[], permission_version }
Failure: uniform 401 "Invalid email or password" (no user enumeration); audit `auth/login.failed`
```

`login.failed` is written in its own transaction (the request session rolls back on the 401);
`logout` writes `auth/logout`. All three land in `audit_logs` (FR-01, TRD §5.2) and are
queryable via `GET /api/v1/audit/logs?module=auth`.

### CSRF

Every unsafe method (`POST/PUT/PATCH/DELETE`) must send header `X-CSRF-Token` equal to the
`gs_csrf` cookie. Enforced by `verify_csrf` inside the `require_auth` dependency.
`GET/HEAD/OPTIONS` are exempt. The frontend client adds the header automatically.

### Authorization

`require_permission("<module>:<action>")` loads the user's permissions (superadmin ⇒ `*`)
and 403s on mismatch. Permission catalogue: `backend/app/core/rbac.py`.
Community scope is derived from the user's `user_roles` grant — **never** from a client-supplied value.

### Frontend route protection

`middleware.ts` redirects to `/login?next=…` when `gs_session` is absent (presence check only).
Pages call `/auth/me` and gate UI on `permissions`. The backend re-validates every request.

### Local vs staging

| | Local | Staging |
|-|-------|---------|
| `COOKIE_SECURE` | `false` | `true` |
| Same-origin `/api` | Next.js rewrite → `backend:8000` | Vercel rewrite / same domain → Render |
| Session store | local Redis | Upstash Redis |

> Cross-site cookies are avoided by keeping the API same-origin (`/api/*`). If the API is ever
> put on a different domain, cookies need `SameSite=None; Secure` and exact CORS origins.

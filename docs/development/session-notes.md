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

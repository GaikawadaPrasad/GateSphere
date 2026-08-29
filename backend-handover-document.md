# GateSphere — Backend Handover Document

_Last updated: 2026-08-28 · Branch: `main` (not yet pushed — foundation work, per the owner's instruction)_

This document is the single entry point for anyone (human or agent) picking up the GateSphere
backend. Read this, then [`AGENTS.md`](AGENTS.md) (project standards) and
[`docs/development/session-notes.md`](docs/development/session-notes.md) (chronological log).

---

## 1. What GateSphere is

Enterprise residential-community platform: visitor & gate security, domestic staff, deliveries,
vehicles & parking, maintenance billing, complaints, amenities, communication, incidents,
dashboards, notifications. Multi-tenant — one deployment serves many **communities**.

## 2. Stack

| Concern | Local | Staging target |
|---|---|---|
| API | FastAPI (async) + SQLAlchemy 2.0 async (AsyncSession, psycopg 3) + Alembic | Render |
| DB | PostgreSQL 15 | Supabase |
| Object store | MinIO (S3 API) | Supabase S3 |
| Cache / sessions | Redis | Upstash |
| Workers | Celery | (TBD) |
| Email | Brevo | Brevo |
| Frontend | Next.js (App Router) | Vercel |

Auth is **session-cookie** for every actor (`gs_session` opaque token, `gs_csrf` double-submit).
Identity is **UUID v4** primary keys everywhere (ADR-009).

## 3. How to run locally

```bash
cp .env.example .env   # then fill secrets — see STARTER.md
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.seed
```

Ports on the dev machine (others were taken): API `8001`, web `13000`, Postgres `55432`,
Redis `56379`, MinIO `59000/59001`.

Health: `GET http://localhost:8001/` returns app name, version, env, and component health.

Demo users: `<role>@gatesphere.com` / `<role>@Gate2026!` — e.g. `super_admin@gatesphere.com` /
`super_admin@Gate2026!`. Roles: `super_admin`, `community_admin`, `association_committee`,
`facility_manager`, `security_supervisor`, `security_guard`, `resident`, `domestic_staff`,
`vendor_technician`, `auditor`.

### Test / lint

```bash
docker compose exec backend sh -c "ruff check . && black --check . && pytest -q"
```

CI runs **lint / format only** (ruff, black, eslint, prettier) — no tests/build/migrations in CI
for now, by owner's instruction.

## 4. Architecture & conventions (the important part)

### Layering — strict

```
router  → HTTP boundary only: permission dep, parse body, call service, wrap in envelope
service → ALL business rules (async def), state machines, record_audit_async(), txn orchestration
repository → queries only; AsyncTenantRepository filters every query by community_id
model   → SQLAlchemy ORM + DB constraints
```

Routers never touch the DB session directly except through the service. Services never import
FastAPI request/response types beyond `Request` (for audit context).

### Response envelope — every endpoint

```json
{ "success": true, "message": "OK", "data": <T | null>, "meta": <PageMeta | null> }
```

Errors: `{ "success": false, "message": "...", "data": null, "error": { "code": "...", "fields": {...}? } }`.
Helpers in `app/core/responses.py` (`ok()`, `paginated()`); central exception handlers in
`app/core/errors.py` (`AppError` hierarchy → `AuthError` 401, `ForbiddenError` 403,
`NotFoundError` 404, `ConflictError` 409, `BusinessRuleError` 422).

### Multi-tenancy

- `communities` is the tenant root (not itself scoped). **Every** other tenant table has
  `community_id` and composite tenant-safe FKs: `(child_id, community_id) → parent(id, community_id)`
  so a row can never reference a parent in another community.
- Cross-tenant access is a **404, never a 403**.
- RLS: each migration enables `tenant_isolation` policy on its new tenant tables, driven by the
  `app.community_ids` GUC set per-request via `bind_rls_scope_async`. **RLS is a defense-in-depth
  layer and is not exercised by the local test DB** (Postgres superuser bypasses RLS) — tenant
  isolation is actually verified by `AsyncTenantRepository._scoped()` + cross-tenant-404 integration
  tests. See AGENTS.md §12.

### RBAC

`require_permission_async("<module>:<action>")` dependency. Permission catalogue and per-role grants
live in `app/core/rbac.py` (`ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`). `super_admin` → `{"*"}`.
Re-run `python -m app.scripts.seed` after changing grants (it upserts `role_permissions`).

### Schemas

Pydantic v2. Write bodies use `ConfigDict(extra="forbid")` (mass-assignment guard).
`*Create` / `*Update` / `*Read`; `*Read` uses `from_attributes=True`. Never serialize an ORM
model directly — always `SomeRead.model_validate(obj)`.

### Audit

`app/modules/audit/service.py::record_audit_async(db, module=, action=, actor=, community_id=,
entity_type=, entity_id=, old=, new=, request=)` — awaited **inside the operation's
transaction**. `audit_logs` is append-only. `_jsonable` handles UUID / Decimal / datetime / date.

### Hashing

- Passwords: Argon2 (`app/core/security.py`).
- Lookup keys / pass tokens (phone, ID numbers, QR tokens): **non-reversible** HMAC-SHA256 via
  `app/core/hashing.py::digest()` — never store these in plaintext.

### Migrations

**Hand-written**, sequential ids `0001` … `0012`. Autogenerate is NOT used — it is polluted by
model (`default=`) vs migration (`server_default=`) drift. Each module's migration:
1. creates its tables with `server_default`s matching the model defaults,
2. adds any composite-FK `UniqueConstraint((id, community_id))` needed by children,
3. enables RLS on the new tenant tables,
4. renames/patches anything an earlier migration left inconsistent.

Always test the round-trip: `alembic downgrade <prev> && alembic upgrade head`, then reseed.

### Line endings

`.gitattributes` forces LF (the container entrypoint is a shell script). **Do not** write files
with a Windows Python `pathlib.write_text()` — it emits cp1252 and corrupts em-dashes. Use the
editor tools or `write_text(s, encoding="utf-8", newline="\n")`.

## 5. Module build-out status

The **reference module is `communities`** — copy its shape. Pattern (also in AGENTS.md §23):

```
models.py → schemas.py → repository.py → service.py → deps.py → router.py
→ alembic/versions/00NN_<module>.py (+ RLS)
→ extend app/scripts/seed.py
→ app/modules/<m>/tests/{conftest,test_<m>_unit,test_<m>_api}.py
→ docs/backend/modules/<m>/README.md + docs/backend/api/<m>.md
→ update AGENTS.md §23 table + docs/development/session-notes.md
→ one commit: feat(<m>): FR-NN <Name> module   (NO Co-Authored-By trailer)
```

| FR | Module | Status | Migration |
|----|--------|--------|-----------|
| 01 | auth / sessions | ✅ implemented | 0001–0003 |
| 02 | users / RBAC | ✅ implemented | 0003 |
| 16 | audit | ✅ `audit_logs` + `record_audit()` | 0005 |
| 03 | communities & property | ✅ implemented (reference module) | 0004 |
| 03 | residents | ✅ implemented | 0006 |
| 04 | visitors | ✅ implemented | 0007 |
| 05 | gate / security ops | ✅ implemented | 0008 |
| 06 | domestic_staff | ✅ implemented | 0009 |
| 07 | deliveries | ✅ implemented | 0010 |
| 08 | vehicles & parking | ✅ implemented | 0011 |
| 09 | billing | ✅ implemented | 0012 |
| 10 | complaints | ✅ implemented | 0013 |
| 11 | amenities | ✅ implemented | 0014 |
| 12 | communication | ✅ implemented | 0015 |
| 13 | incidents | ✅ implemented | 0016 |
| 14 | dashboards | ✅ implemented (no tables) | — |
| 15 | notifications | ✅ implemented | 0017 |

**All 15 FR modules + the auth/RBAC/audit foundation are implemented.** Migrations `0001`–`0017`.

Still open (integration/polish — see `AGENTS.md §23`):
- **RLS enforcement test suite** — connect as a restricted DB role (superuser bypasses RLS).
- **Notification wiring** — domain modules emit audit-only events today; route the user-facing
  ones through `NotificationService.dispatch()` + the Celery `tasks.py` hooks.
- **Audit read API** (FR-16), **user/role management endpoints** (FR-02).
- **Deferred child tables** — `ticket_attachments`, `incident_attachments`, `resident_groups`.

Test count: **217 passing** (`pytest -q`). Backend is fully async (ADR-010).

## 7. Key decisions (ADRs — see `docs/decisions/`)

- **ADR-009**: UUID v4 PKs repo-wide (deviates from ERD v1.2 BIGINT — chosen for
  non-enumerable resource ids in a security product).
- Response envelope `{success, message, data, meta}` on every endpoint (owner request).
- Hand-written migrations (autogenerate drift).
- Simulated payments only — no external gateway is integrated (`gateway_name="simulated"`).
- Commits go straight to `main` (foundation phase); **no push until the owner says so**;
  **no `Co-Authored-By` trailer**.

## 8. Gotchas hit so far

- `email-validator` rejects `.local` / `.io` TLDs → demo domain is `gatesphere.com`.
- `from __future__ import annotations` + slowapi `@limiter.limit` broke FastAPI body-param
  detection in `auth/router.py` → removed there.
- 204 endpoints need `response_class=Response` and `return Response(status_code=204)`.
- INET columns reject non-IP hosts (TestClient sends `testclient`) → `_client_ip()` validates.
- Login rate-limit (5/min) trips test suites → `conftest.py` autouse fixture disables the limiter.
- `as_role(...)` in `backend/conftest.py` returns a **fresh** `TestClient` per call — do not
  assume two role clients share state.
- Non-idempotent API tests that `commit()` rows must clean up (unique email / plate / code via
  `uuid4().hex`, delete in a `finally`).

## 9. Where things live

```
backend/
  app/
    core/          config, security (sessions), errors, responses, rbac, tenancy, hashing
    db/            base_class (pk/fk/mixins), base (model registry), repository, session
    modules/<m>/   models, schemas, repository, service, deps, router, tasks, tests/
    api/router.py  aggregate router — one include per module
    scripts/seed.py  idempotent synthetic data (extend per module)
  alembic/versions/  0001 … 0012
  conftest.py      shared fixtures: client, auth_client, as_role, seed_ids, unique_code
docs/
  backend/modules/<m>/README.md   canonical module spec
  backend/api/<m>.md               endpoint contract
  database/schema.md               all table shapes
  development/session-notes.md     chronological log (newest first)
AGENTS.md          project standards — READ THIS
```

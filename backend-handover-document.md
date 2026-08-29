# GateSphere — Backend Handover Document

_Last updated: 2026-08-29 · Branch: `main` (not yet pushed — foundation work, per the owner's instruction)_

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

**Hand-written**, sequential ids `0001` … `0023`. Autogenerate is NOT used — it is polluted by
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

Every module is **fully async** (ADR-010): `AsyncTenantRepository` → `async def` service +
`record_audit_async` → `async_tenant_context` deps → `async def` router.

| FR | Module | Status | Migration |
|----|--------|--------|-----------|
| 01 | auth / sessions | ✅ implemented (async login/logout/me) | 0001–0003 |
| 02 | users / RBAC | ✅ implemented — user + role-grant read/write API (`GET/POST /users`, `PATCH /users/{id}`, `GET /users/roles`, `POST/DELETE /users/{id}/roles`) | 0003 |
| 16 | audit | ✅ `audit_logs` + `record_audit_async()` + **query API** (`GET /audit/logs` w/ filters, `GET /audit/logs/{id}`, `GET /audit/logs.csv`) | 0005 |
| 03 | communities & property | ✅ implemented (reference module) | 0004 |
| 03 | residents | ✅ implemented | 0006 |
| 04 | visitors | ✅ implemented — QR **and PIN** pass verification, `visitor_request_members` grouping | 0007, 0020 |
| 05 | gate / security ops | ✅ implemented — panic alert fans a notification to on-duty guards/supervisors | 0008 |
| 06 | domestic_staff | ✅ implemented | 0009 |
| 07 | deliveries | ✅ implemented | 0010 |
| 08 | vehicles & parking | ✅ implemented | 0011 |
| 09 | billing | ✅ implemented — payment **receipts** (`RCP-…` + `GET /billing/payments/{id}/receipt`) | 0012, 0021 |
| 10 | complaints | ✅ implemented — SLA **escalation sweep** (`on_track→at_risk→breached→escalated`) | 0013, 0019 |
| 11 | amenities | ✅ implemented | 0014 |
| 12 | communication | ✅ implemented — `resident_groups` + members, group-targeted announcements | 0015, 0018 |
| 13 | incidents | ✅ implemented — `incident_attachments` | 0016, 0018 |
| 14 | dashboards | ✅ implemented (no tables) | — |
| 15 | notifications | ✅ implemented — domain events wired to the inbox via `notifications.events.emit` / `emit_to_roles` | 0017 |
| — | uploads pipeline | ✅ `/uploads` presign + fixed catalogue + `POST /uploads/{id}/confirm` (magic-byte check) + `managed_files` | 0022 |
| — | rbac config | ✅ `/rbac` — platform-admin edits a role's global permission set + per-community `allow`/`deny` overrides (`community_role_permissions`); every change bumps `users.permission_version` + revokes sessions | 0023 |
| — | onboarding | ✅ `/communities/{id}/invitations` URL invites + public `GET`/`POST /invitations/{token}[/accept]`; direct `POST /communities/{id}/tenants`, `DELETE …/tenants/{profile_id}`, `DELETE …/units/{unit_id}/occupants/{occupancy_id}` | 0023 |

**All FR modules + the auth/RBAC/audit foundation are implemented.** Migrations `0001`–`0023`.
The 2026-08-28 QA/acceptance gap sweep (7 items) and the async migration are done — see
`docs/development/session-notes.md` and `docs/decisions/ADR-010-async-stack.md`.

### Background jobs (Celery beat — `app/core/celery_app.py`)

Every task uses `app/core/jobs.py` (`job_session` async ctx mgr + global `system_scope` +
seeded `system@` audit actor) and applies the same service-layer transition rules.

| Task | Cadence | Effect |
|---|---|---|
| `complaints.tasks.sweep_ticket_sla` | 5 min | advance `service_tickets.escalation_state`, notify resident + escalation role |
| `billing.tasks.sweep_overdue_invoices` | daily 01:00 | past-due `posted`/`partially_paid` → `overdue` + notify |
| `billing.tasks.send_dues_reminders` | Mon 09:00 | recurring nudge for every invoice with a balance |
| `visitors.tasks.expire_stale_requests` | 15 min | `pending`/`approved` past `valid_until` → `expired` |
| `amenities.tasks.close_past_bookings` | 15 min | `confirmed` past `end_at` → `completed` |

### Still open (feature work — see `AGENTS.md` "Still open")

- **Frontend** — design system, community switcher UI, and the live Security Gate dashboard
  refresh (backend supports **short polling** of `/gate/events` + `/gate/alerts` +
  `/dashboards/security`; no SSE/WebSocket endpoint, per TRD §3.1).
- **Real email/SMS providers** — every notification channel except `in_app` is simulated
  (SMS/WhatsApp provider is out of PRD/SRS scope).
- Invitation emails are not sent — `accept_url` is returned in the create response for the
  frontend/owner to deliver.

Permission propagation is done: `user_permissions_async(db, user, community_id=)` applies
per-community overrides; role grant/revoke and every RBAC edit call
`invalidate_user_permissions_async` (bump `permission_version` + revoke sessions); `/auth/me`
returns `permission_version` for the frontend to poll.

PRD/TRD/SRS gap sweep (2026-08-30): **auth audit** (login success/failure + logout →
`audit_logs`, FR-01 / TRD §5.2), **gate checkpoint override** (`POST /gate/checkpoint-override`,
`gate:approve` — Security Supervisor / Community Admin, FR-05), **security dashboard
`expected_visitors`** (FR-14). All other FR-01…FR-19 requirements verified present.

Test count: **243 passing** (`pytest -q`). RLS enforcement is covered by
`backend/tests/test_tenant_isolation.py` (connects as a restricted non-superuser DB role).

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
  alembic/versions/  0001 … 0023
  conftest.py      shared fixtures: client, auth_client, as_role, seed_ids, unique_code
docs/
  backend/modules/<m>/README.md   canonical module spec
  backend/api/<m>.md               endpoint contract
  database/schema.md               all table shapes
  development/session-notes.md     chronological log (newest first)
AGENTS.md          project standards — READ THIS
```

# GateSphere — Backend API Architecture

Diagrams: `docs/architecture/backend/backend-architecture.mmd` (combined) +
`docs/architecture/backend/modules/<module>.mmd`. Route table:
`docs/architecture/backend/route-inventory.md`.

## Stack

FastAPI (Python 3.12, async) · SQLAlchemy 2.0 + Alembic · PostgreSQL 15+ (Supabase in
staging) · Redis (session cache + Celery broker) · Celery + beat (jobs) · S3/MinIO
(uploads) · Brevo (email; SMS/WhatsApp mocked). RESTful JSON, versioned `/api/v1`.

## Request pipeline (`app/main.py`)

```
Client ──HTTPS──▶ TrustedHostMiddleware ──▶ SecurityHeadersMiddleware ──▶ CORSMiddleware
       ──▶ CorrelationIdMiddleware (X-Request-ID) ──▶ RateLimitMiddleware (Redis sliding window, path classes)
       ──▶ exception handlers (canonical envelope; no SQL/stack/secret leak)
       ──▶ _select_session_token ──▶ verify_csrf ──▶ _load_session_async ──▶ require_auth_async
       ──▶ get_tenant_scope_async ──▶ require_permission_async / require_platform_admin
       ──▶ ROUTER ──▶ SERVICE ──▶ REPOSITORY ──▶ MODEL ──▶ PostgreSQL
```

`/docs`, `/redoc`, `openapi.json` are disabled when `ENVIRONMENT=production` unless
`ENABLE_DOCS=true`. `/healthz` (liveness) + `/readyz` (DB+Redis, 503 when degraded) +
per-module `/api/v1/<module>/health`.

## Layering (AGENTS.md §2 — never skip one)

| Layer | File | Responsibility | Must not |
|---|---|---|---|
| Router | `modules/*/router.py` | HTTP I/O: resolve auth+permission deps, validate the Pydantic request, bind tenant scope, call **one** service method, serialize | `db.query`; business logic |
| Service | `modules/*/service.py` | all business rules: state machines, invariants, SLA timers, booking conflict, invoice generation, transaction orchestration, event emission (audit + notification) | *(target)* import `fastapi`/ORM — see tracked debt C-2/C-3 |
| Repository | `db/repository.py` + `modules/*/repository.py` | SQLAlchemy queries only; **always** filters tenant tables by `community_id` (`AsyncTenantRepository._scoped()`) | business rules; commit a transaction |
| Model | `modules/*/models.py` | ORM table def; encodes invariants as DB constraints too (CHECK, UNIQUE, partial-unique, FK ON DELETE) | — |

Cross-cutting: `audit` and `notifications` are **leaf** services — domain event →
`notif_events.emit*` / `record_audit_async` → provider adapter. No reverse dependency from
a cross-cutting service back to a domain router/service.

## Canonical response envelope (AGENTS.md §6)

```json
{ "success": true|false, "message": "...", "data": <payload|null>, "meta": <pagination|null>,
  "error": { "code": "SCREAMING_SNAKE", "fields": { "<field>": "<msg>" } } }
```

Error mapping (`app/core/errors.py`): `AppError→{401,403,404,409,422}` ·
`RequestValidationError→422` (field map) · `IntegrityError→409/400` by PG SQLSTATE ·
`SQLAlchemyError→500` "A database error occurred." · catch-all `Exception→500`
"An unexpected error occurred." Every 500 is logged with the request id; nothing internal
reaches the client.

## Modules (FR-01…FR-19)

`auth` · `users`/`rbac` · `communities`/`onboarding`/`residents` · `visitors` · `gate` ·
`domestic_staff` · `deliveries` · `vehicles` · `billing` · `complaints` · `amenities` ·
`communication` · `incidents` · `dashboards` · `notifications` · `audit` · `uploads`.
253 routes total (see route-inventory.md); 289-request Postman suite (`docs/postman/`).

## Background jobs (Celery beat — `app/core/celery_app.py`)

`complaints.sweep_ticket_sla` (5m) · `visitors.expire_stale_requests` (15m) ·
`amenities.close_past_bookings` (15m) · `billing.sweep_overdue_invoices` (01:00) ·
`billing.send_dues_reminders` (Mon 09:00). Jobs run under `system@` actor + a global
scope (`app/core/jobs.py`). **No route invokes Celery synchronously.**

## Auth & tenancy

See `docs/backend/AUTHENTICATION.md` (role-bucketed session cookies, multi-role, logout
isolation) and `docs/backend/RBAC.md` (54 permission codes, 3 enforcement layers,
per-community overrides). Tenant isolation: repository `_scoped()` + Postgres RLS
(`tenant_isolation` policy, 56 tables); cross-tenant object → **404**.

## State machines

Every lifecycle's transition table + enforcement + audit/notification side-effects:
`docs/backend/STATE_MACHINES.md`. Graph enforced in the service
(`app/core/state_machine.py::ensure_transition` or an explicit guard); value set pinned by
a DB `CHECK` (migration `0025`).

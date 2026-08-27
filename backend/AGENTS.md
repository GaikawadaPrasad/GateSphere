# backend/AGENTS.md — FastAPI specifics

Extends the root [`../AGENTS.md`](../AGENTS.md) (read it first — especially §2 layering, §3
multi-tenancy/RBAC, §4 backend how-to, §6 API contract, §7 auth, §8 DB, §10 module rules).
Root rules win on any conflict. Canonical schema: [`../docs/database/schema.md`](../docs/database/schema.md).
API contract: [`../docs/platform/api-contract.md`](../docs/platform/api-contract.md).

## Layering
`router → service → repository → model`. Routers never touch the ORM directly; services never
import `fastapi`. Cross-cutting concerns are dependencies/middleware, applied uniformly.

## Routers
- Thin. `Depends(require_permission("<module>:<action>"))` + bind tenant scope, validate the
  Pydantic request schema, call the service, return a `*Read` response schema.
- No `db.query(...)` in a router. Declare `response_model`; give every route a `summary`.
- Public routes are the rare exception and must be called out in review.

## Schemas
- Separate `*Create` / `*Update` / `*Read`. Only `*Read` leaves the API — never an ORM model.
- No `Any`. `Annotated` + validators. Enums for fixed sets (visitor category, delivery protocol,
  incident severity, ticket status, …).
- Responses follow the envelope: `{data, meta}` for lists, `{data}` for single, `{error:{code,message,fields}}` for errors.

## Services
- All business rules and state-machine transitions (see root §10). Own the transaction boundary.
- Write the `audit_logs` row **in the same transaction** as the sensitive action.
- Enqueue notifications **after commit** (Celery) — the originating record is the source of truth.
- Pure-ish: `(Session, typed args) -> domain object / DTO`. Unit-testable without HTTP.
- Business-rule failures → `422` with a structured `error` body. Conflicts (booking/parking) → `409`.

## Repositories
- Only place with SQLAlchemy queries. Return models or scalars.
- **Always** filter tenant tables by `community_id`, applied before execution.
- `selectinload` / `joinedload` to kill N+1.

## Models
- `id BIGINT` identity per ERD v1.2 (_scaffold currently UUID — see root §17_).
- `community_id` FK + index on every tenant table; composite tenant-safe FKs to parents.
- `created_at` / `updated_at` (`TIMESTAMPTZ`) + `created_by` where an actor exists.
- Encode invariants as `UNIQUE` / `CHECK` / `EXCLUDE` — not only in Python (see schema.md).
- Append-only tables (`audit_logs`, `gate_events`, `delivery_events`, `*_status_history`,
  `incident_actions`, `notification_deliveries`): INSERT only from app code.
- Config-as-data lives in `*_rules` / `*_policies` tables — never hardcode SLA/protocol/booking/billing rules.

## Migrations
- One Alembic revision per change; hand-review the generated SQL; real `downgrade()`.
- Register new model modules in `app/db/base.py`. Update `docs/database/schema.md` in the same PR.
- Never hand-edit a deployed schema. FastAPI must not keep a competing migration history.

## Auth / RBAC / tenancy
- Session cookies (`gs_session` HttpOnly + `gs_csrf`), Argon2, `user_sessions` table is the
  durable store (Redis may cache). Revoke on logout / password change / role change.
- Permission strings in `app/core/rbac.py` — add there + reseed.
- Never trust a client-supplied `community_id` for authorization — derive from the role grant.
- Cross-tenant object access → `404`, not `403`.
- Auditor role: no write route accepts it.

## Async / Celery
- `async def` for all I/O endpoints. Gate + dashboard endpoints are latency-critical (sub-second).
- Long / retryable / scheduled work → `tasks.py`, idempotent, registered in `app/core/celery_app.py`.

## Concurrency
- Amenity booking confirm + parking allocation: one transaction + `SELECT … FOR UPDATE` or a DB
  `EXCLUDE`/partial-unique constraint. Losers get `409`.

## Tests
- `tests/` per module. Fixtures `client` / `auth_client` in `backend/conftest.py`.
- Test permission failures (`401` / `403`) and cross-tenant `404` as first-class cases.

## Tooling
`ruff check .` (incl. `S`) · `black --check .` · `mypy app` · `pytest` — all green before PR.

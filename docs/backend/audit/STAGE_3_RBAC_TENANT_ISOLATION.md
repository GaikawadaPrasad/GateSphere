# Stage 3 — RBAC + Multi-Community Tenant Isolation (fix mode)

**Date:** 2026-08-31

## What was audited

- Dependency direction of the authz layer (C-1 from Stage 1).
- `AsyncTenantRepository` — the single choke point every tenant query flows through.
- All 60+ direct `self.db.scalar/scalars/execute(select(...))` call sites in services
  (the C-3 raw-query surface) for a missing `community_id` filter.
- The two object-level-authz routes carried from Stage 2
  (`POST /gate/alerts/{id}/cancel`, `GET /uploads/download`).
- Live cross-tenant IDOR across 14 entity types × 2 non-global roles.
- Existing coverage: per-module `test_*_api.py` cross-tenant checks (16 modules),
  DB-level `test_tenant_isolation.py` (Postgres RLS `tenant_isolation` policy proven with a
  `NOBYPASSRLS` role over 19 tenant tables).

## Verdict: the isolation model is sound. One real bug fixed; one API gap logged.

### `AsyncTenantRepository` (`app/db/repository.py`)
- `.get(id)` → `SELECT … WHERE id=? AND community_id IN scope` → cross-tenant = `None` = 404.
- `.list()` / `.count()` → `_scoped()` always applied.
- `.add(obj)` → `scope.require(obj.community_id)` → cannot insert outside scope.
- Global scope (super_admin / auditor) bypasses by design; `X-Community-Id` narrows it.
Raw `select()` in services is consistently funnelled back through `repo.list(extra=stmt)`
(which re-applies `_scoped()`), or guarded by explicit
`if not scope.is_global: stmt = stmt.where(Model.community_id.in_(scope.community_ids))`
helpers (`_unit_in_scope`, `_gate_in_scope`, `_one_community`, `_community`). Occupancy /
child-row lookups keyed by an already-scope-validated `unit_id` are safe (validated-FK).

### Object-level authz — both correct
| Route | Control | Result |
|---|---|---|
| `POST /gate/alerts/{id}/cancel` | `obj.triggered_by_user_id != actor.id → ForbiddenError(NOT_ALERT_OWNER)`; `_get_alert` is scope-filtered | ✅ |
| `GET /uploads/download` | `_assert_can_access`: creator OR same-community member OR global; else 404. Authorises by the `managed_files` row for the key, never a raw object key | ✅ |

---

## Findings & fixes

### C-1 (HIGH) — `security` ↔ `tenancy` bidirectional dependency — **FIXED**
- Removed the `require_permission_async` re-export (and the PEP 562 `__getattr__`) from
  `app/core/security.py`.
- Repointed all 18 routers: `from app.core.tenancy import require_permission_async`.
- `rbac/router.py` now imports `require_platform_admin` from `security` and
  `require_permission_async` from `tenancy` on separate lines.
- **Re-ran the import graph: SCC cycles 0, pair cycles 0.** Direction is one-way
  `tenancy → security`. `app.main` still imports (256 routes), ruff clean, 268 tests pass.
- Diagram updated: `backend-architecture.mmd` AUTHZ node.

### RB-1 (HIGH, correctness/data-exposure) — audit-log endpoint 500s on any row with a real client IP — **FIXED**
- **Root cause of the "shared-test-DB flake"** the brief asked to run down.
  `audit_logs.ip_address` is a PostgreSQL `INET` column; psycopg returns it as an
  `ipaddress.IPv4Address`. `AuditLogRead.ip_address: str` does **not** coerce it, so
  `GET /api/v1/audit/logs` (and `/logs/{id}`, `/logs.csv` via the same model) raised
  `ValidationError` → `500 / "Response validation failed"` for **every** audit row written
  from a real HTTP request. It never surfaced in isolated test runs because Starlette's
  `TestClient` sends host `"testclient"`, which `_client_ip()` rejects → stored `NULL`.
  `test_auth_audit.py` failed only in the *full* suite because an earlier real request
  (the Stage-2 live smoke) had written `login.success` rows with `ip_address = 172.20.0.1`.
- **Fix:** `@field_validator("ip_address", mode="before")` on `AuditLogRead` → `str(v)`.
- **Verified:** reproduced (`raw ip type: ipaddress.IPv4Address`), fixed
  (`serialized: 203.0.113.9`); full suite green with the polluted rows still present.
- Not a test-isolation defect per se — but see IS-1 below for the residual isolation risk.

### IS-1 (LOW, test infra) — Celery `beat`/`worker` mutate the test DB
`docker compose` runs `beat` + `worker` against the same database the suite uses; scheduled
sweeps (`sweep_overdue_invoices`, `close_past_bookings`, `sweep_ticket_sla`,
`expire_stale_requests`) fire every few minutes and can change row counts mid-test.
- No test currently fails from this (assertions use `>=` / relative deltas), but it is a
  latent flake source.
- **Recommendation (Stage 5 / test-isolation):** `docker compose` profile that runs
  `pytest` with `beat` stopped, or a `pytest` marker that pins/pauses the beat schedule.
  Logged, not yet actioned.

### R-1 follow-up (LOW) — invitation token in URL path
Deferred to Stage 4 (session/onboarding) as planned — verify single-use + TTL + no
plaintext logging.

### AMEN-1 (MEDIUM, API completeness — for Stage 7) — no `GET /api/v1/amenities/{amenity_id}`
`amenities` exposes `PATCH /amenities/{id}` and several `GET /amenities/{id}/<child>` but no
"fetch one amenity" endpoint. A client that holds only an amenity id cannot read it back.
Every other primary entity has a `GET /{id}`. Logged for the missing-module/CRUD stage.

---

## Changes made

| File | Change |
|---|---|
| `backend/app/core/security.py` | drop `require_permission_async` re-export + `__getattr__` |
| `backend/app/modules/*/router.py` (18) | import `require_permission_async` from `app.core.tenancy` |
| `backend/app/modules/audit/schemas.py` | `ip_address` before-validator (INET → str) |
| `backend/tests/test_cross_tenant_idor.py` | **new** — 29-assertion consolidated cross-tenant sweep |
| `docs/architecture/backend/backend-architecture.mmd` | AUTHZ node reflects one-way dep |

## Tests / commands executed

```
import graph rebuild            → SCC cycles: 0   pair cycles: 0
python -c import app.main       → 256 routes OK
ruff check .                    → All checks passed!
black --check (changed files)   → unchanged
pytest -q (full suite, Docker)  → PYTEST_EXIT=0  (268 tests: 239 + 29 new)
pytest tests/test_cross_tenant_idor.py → 29 passed
ip_address repro/fix probe      → bug reproduced, fix verified
mermaid-cli validate            → chart generated (valid)
```

## Issue counts (this stage)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 (both fixed) | C-1, RB-1 |
| Medium | 1 (logged → Stage 7) | AMEN-1 |
| Low | 2 (logged) | IS-1, R-1 |

## Pre-existing, not introduced (carry to Stage 8/10)
- `mypy` errors at `app/core/security.py:141` — `response.set_cookie(..., **common)` where
  `common: dict[str, int | str | None]`. Present on `main`. CI gates on ruff + black only.

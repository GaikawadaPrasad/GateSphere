# Stage 1 — Import & Dependency Graph Audit (read-only)

**Date:** 2026-08-31
**Scope:** all 271 Python modules under `backend/app/`
**Method:** AST-derived import graph (not runtime), Tarjan SCC for cycles, layer-rank
rule for architectural-direction violations. Graph builder:
`scratchpad/impgraph.py` (kept out of tree).

## Summary

| Metric | Value |
|---|---|
| Python modules | 271 |
| Intra-`app` import edges | 788 |
| Strongly-connected components (size > 1) | **1** |
| Pair cycles (A↔B) | **1** |
| Package `__init__.py` import cycles | 0 |
| `notification → domain router/service` reverse deps | 0 |
| `audit → domain router/service` reverse deps | 0 |
| Cross-module `service/repo/model → other module .router` imports | 0 |

## Entry-path import verification (in Docker)

| Path | Result |
|---|---|
| `python -c "import app"` | OK |
| `import app.main` (FastAPI startup) | OK — 256 routes |
| `from app.core.celery_app import celery` + all 19 `*/tasks.py` | OK |
| Alembic env + `ScriptDirectory` walk | OK — 23 revisions |
| `import app.scripts.seed` | OK |
| Every `app/modules/*/router.py` | OK |
| `pytest --co` | OK — 239 tests, 0 collection errors |
| `docker compose` worker boot | OK — Celery `ready`, scheduled tasks succeed |

---

## Findings

### C-1 (HIGH) — `app.core.security` ↔ `app.core.tenancy` bidirectional dependency

```
app.core.jobs ──▶ app.core.tenancy ──▶ app.core.security ──▶ app.core.tenancy
                        (line 27)            (require_permission_async re-export)
```

- **Runtime cycle:** already broken (this session) by converting the bottom-of-file
  `from app.core.tenancy import require_permission_async` in `security.py` into a PEP 562
  module `__getattr__`. Worker now boots.
- **Architectural cycle: still present.** `security.py` still *names* `tenancy` internally
  purely to re-export `require_permission_async` for ~20 routers that historically imported
  it from `app.core.security`. The dependency direction should be one-way
  (`tenancy → security`), never both.
- **Why it exists:** `require_permission_async` needs the resolved `TenantScope` (defined in
  `tenancy`), so it lives in `tenancy`; but callers were coded against `app.core.security`.
- **Planned fix (Stage 3):** introduce `app.core.authz` (or export from `tenancy` only),
  repoint the ~20 routers, delete the `security.py` re-export + `__getattr__`. Re-run the
  graph; expect SCC count → 0.

### C-2 (MEDIUM) — every `service.py` imports `from fastapi import Request`

`AGENTS.md §2` states a service "must not import `fastapi`, `Request`, or an ORM class".
**20/20 service modules** (+ `audit/service.py`, `audit/query_service.py`,
`onboarding/service.py`) take `request: Request | None` in `__init__` / factory, threaded
through only for audit client-IP/context capture.

- This is a **systemic, deliberate** pattern, not an accident.
- Options: (a) reconcile `AGENTS.md` to permit `Request` as an opaque audit-context carrier;
  (b) replace with a framework-agnostic `RequestContext` value object built in the router.
- Given "a pattern used throughout the codebase *is* the standard" and "preserve architecture
  unless the audit demonstrates a change is required", recommendation is **(b) a small
  `app/core/context.py::RequestContext`** value object (ip, user_agent, request_id) built in
  the router dependency and passed down — removes the framework import from the business
  layer without rewriting logic. Deferred to Stage 10 (or Stage 8 with audit work).

### C-3 (MEDIUM) — services perform raw ORM queries (`select(...)`)

**18/20 service modules** build `select()` statements directly instead of delegating to a
repository. `AGENTS.md §2` reserves SQLAlchemy queries for the repository layer. Heaviest:
`visitors/service.py`, `dashboards/service.py`, `billing/service.py`.

- Real layering debt but very large surface. Not import-graph-breaking.
- Recommendation: **do not mass-refactor** now (risk/scope). Note as tracked debt; enforce
  the rule for *new* code; opportunistically move queries to repos when a service is touched
  for another finding. Stage 10 updates `AGENTS.md §2` to state the current reality + the
  target, so the rule and the code stop disagreeing.

### C-4 (MEDIUM) — `app/modules/auth/router.py` does direct data access

`router.py` lines 43, 105 call `db.scalar(select(User...))` / `db.scalars(select(UserRole...))`
and line 58 `audit_db.commit()`. Router layer should call one service method.

- Localized to one file. Candidate for a real fix in Stage 4 (session/auth stage), moving
  the lookups into `auth/service.py` / `auth/repository.py`.

### C-5 (LOW) — `app.core.*` depends on feature-module models

`app.core.security`, `app.core.tenancy`, `app.core.jobs` import
`app.modules.users.models` / `app.modules.auth.models`. `core` conceptually sits below
feature modules.

- This is the standard "User is a foundational model" compromise and is low-risk (models are
  leaf modules — they import no services). `app.db.base` importing every `*/models` is the
  **correct** SQLAlchemy metadata-registration pattern, not a violation.
- Recommendation: **accept**. Document in `AGENTS.md` that `core` may import `*/models` (leaf)
  but never `*/service`, `*/router`, `*/repository`.

### C-6 (INFO / false positives) — 7 `service → residents/access.py` edges

The graph rule flagged `amenities/billing/communication/complaints/deliveries/incidents/
visitors .service → residents.access` as "service → dependency (reverse)".
**Not a violation.** `residents/access.py` imports only `sqlalchemy` + `*/models` + `errors`;
it is a **service-layer access-control mixin** (`UnitScopedAccess`, `user_in_community`,
`actor_unit_scope`), not a FastAPI dependency. The `.access` filename tripped the heuristic.
No action — recorded so the next audit doesn't re-flag it.

---

## Issue counts

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 1 | C-1 |
| Medium | 3 | C-2, C-3, C-4 |
| Low | 1 | C-5 |
| Info | 1 | C-6 |

## Architecture direction — verified clean

- No router imported by a non-router (except `app.main` importing the aggregator +
  `auth.router` for the login rate-limiter — expected).
- No `model → service`, `repository → router`, `service → other-module router`.
- `notifications` / `audit` are true leaf cross-cutting services: they import only
  `users.models` downward, never a domain router or service. The
  `domain event → notification service → provider adapter` direction holds.
- No `__init__.py` in `app/` performs cross-package imports that could cycle.

**Only one real structural defect exists: C-1**, and its runtime symptom is already fixed.
The remainder is layering debt to pay down incrementally, plus doc/rule reconciliation.

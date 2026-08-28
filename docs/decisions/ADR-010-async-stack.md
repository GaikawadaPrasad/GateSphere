# ADR-010: Migrate to FastAPI async + SQLAlchemy 2.0 async

- **Status:** Accepted — in progress (incremental)
- **Date:** 2026-08-28
- **Relates to:** ADR-001 (backend framework), ADR-003 (authentication — unchanged)

## Context

The backend was built with sync FastAPI handlers and SQLAlchemy 2.0 **sync** (`create_engine`
/ `Session`). Under load, every request holds a worker thread for the whole DB round-trip;
concurrency is bounded by the thread pool. The product owner chose an async stack
(FastAPI `async def` + SQLAlchemy async / `AsyncSession`).

Auth stays as decided in ADR-003: **opaque DB-backed session cookies** (`gs_session` +
`gs_csrf` double-submit), Argon2, `user_sessions` table. No JWT.

## Decision

Migrate the whole backend to async, **incrementally, infra-first**:

1. **Infra (this commit)** — add an async engine + `AsyncSessionLocal` + `get_async_db`
   alongside the sync stack in `app/db/session.py` (psycopg 3 serves both; `greenlet` +
   `pytest-asyncio` added). Both stacks target the same database. Nothing consumes async
   yet; the suite stays green (`test_async_infra.py` is the smoke test).
2. **Per module** — convert `repository → service → router → tests` one module at a time.
   The `TenantRepository` base and the tenancy dependencies (`get_db`, `get_tenant_scope`,
   `tenant_context`, `bind_rls_scope`) grow async twins; a module flips to the async twins
   in a single commit with the suite green at each step.
3. **Cutover** — once every module is async: async Alembic env, drop the sync engine,
   convert Celery task sessions (or keep a dedicated sync engine for jobs — decided at
   cutover), delete the sync dependencies.

## Alternatives considered

- **Big-bang rewrite in one branch** — faster to "done" but the suite is red for the whole
  migration and a regression anywhere blocks everything. Rejected.
- **Stay sync, scale with more workers/threads** — simplest, but does not deliver the
  concurrency profile the owner asked for.

## Trade-offs

- Two stacks coexist for the duration — some duplication in `session.py` / `tenancy.py`.
- `AsyncSession` has no lazy loading; relationships must be eager-loaded or awaited
  explicitly. Repositories already query explicitly, so the blast radius is small.
- RLS GUC (`SELECT set_config('app.community_ids', …, true)`) works unchanged over an async
  connection (verified in `test_async_infra.py`).

## Consequences

- `AGENTS.md` "Still open" tracks the per-module progress.
- Celery workers keep their own engine; jobs are not request-latency sensitive.

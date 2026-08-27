# GateSphere Backend (FastAPI)

Canonical REST API and business-logic tier. Defines the API contract every client follows.

- **Type:** FastAPI service (Uvicorn dev / Gunicorn+Uvicorn workers prod)
- **DB:** PostgreSQL via SQLAlchemy 2.0 + Alembic
- **Cache / sessions:** Redis
- **Background jobs:** Celery (worker + beat), Redis broker
- **Storage:** S3-compatible (MinIO local / Supabase S3 staging)
- **Email:** Brevo (console backend by default in local)
- **Auth:** server-side session cookies (`gs_session` HttpOnly + `gs_csrf` double-submit), Argon2 hashing, RBAC

## Layout

```
app/
  main.py               app factory, middleware, health checks
  core/                 config, security (auth/rbac/csrf), redis, logging, celery_app, rbac catalogue
  db/                   base_class, session, base (model registry for Alembic)
  api/router.py         aggregates every module router under /api/v1
  services/             cross-cutting: email, storage
  modules/<name>/
    router.py           HTTP boundary only
    schemas.py          Pydantic request/response models
    service.py          business logic, transactions, events
    repository.py       SQLAlchemy queries
    models.py           ORM models (community_id on every tenant table)
    tasks.py            Celery tasks
    tests/
  scripts/seed.py       idempotent synthetic seed data
alembic/                migrations
```

## Run

Use the root stack — see [`../STARTER.md`](../STARTER.md). Backend-only commands:

```bash
docker compose run --rm backend pytest          # tests
docker compose run --rm backend migrate         # alembic upgrade head
docker compose run --rm backend seed            # load seed data
docker compose run --rm backend alembic revision --autogenerate -m "msg"
docker compose exec backend bash                # shell
```

Bare metal (needs Python 3.12, Postgres, Redis): `pip install -r requirements.txt`, copy
`.env.example` → `.env`, `alembic upgrade head`, `uvicorn app.main:app --reload`.

## Adding a module

1. Create `app/modules/<name>/` with the standard files (copy an existing module).
2. Include its router in `app/api/router.py`.
3. Add models, register the module in `app/db/base.py`, generate + review a migration.
4. Add permissions to `app/core/rbac.py`; extend `scripts/seed.py`.
5. Write `docs/backend/modules/<name>/README.md` and `docs/backend/api/<name>.md`.
6. Tests for the service layer and every endpoint.

## Quality gates

`ruff check .` · `black --check .` · `mypy app` · `pytest`. See [`../AGENTS.md`](../AGENTS.md)
and [`AGENTS.md`](AGENTS.md).

## Detailed docs

Architecture, API conventions, database, security, operations: [`../docs/`](../docs/).

# Database — Migrations (Alembic)

## Rules
- Every schema change ships as one Alembic revision. No manual `CREATE TABLE` outside Alembic.
- Autogenerate is a starting point — **review every generated file by hand** (column types,
  server defaults, indexes, `ondelete`, data migrations).
- Provide a real `downgrade()`.
- Migrations must apply forward on a fresh DB in CI (`alembic upgrade head`).

## Workflow
```bash
# 1. edit models in backend/app/modules/<m>/models.py
# 2. register the module in backend/app/db/base.py  (import its models)
# 3. generate
make revision m="add visitors and visitor_passes"
# 4. review backend/alembic/versions/<rev>_*.py
# 5. apply
make migrate
```

## Config
- `alembic/env.py` pulls the URL from `app.core.config.settings` and metadata from `app.db.base:Base`.
- Offline mode is disabled on purpose.
- `compare_type` / `compare_server_default` are on.

## Conventions
- Revision id: `NNNN_short_slug` (`0002_visitors`), `down_revision` chained.
- UUID PKs (`sa.Uuid()`), `created_at` / `updated_at` timestamptz with `server_default=now()`.
- Name constraints explicitly for tables that will evolve.

## Baseline
`0001_initial` — communities, towers, floors, units, users, roles, permissions,
role_permissions, user_roles, audit_logs.

# Platform — Local Development

The authoritative step-by-step is **[`../../STARTER.md`](../../STARTER.md)**. This page covers
the how/why behind the local stack.

## Principle

Local mirrors the staging *shape* with self-hosted equivalents, so code never branches on
"am I local". Only endpoints/credentials differ, and they come from config
(`app/core/config.py`), never hardcoded.

| Role | Staging service | Local equivalent | Why it's equivalent |
|------|-----------------|------------------|---------------------|
| DB | Supabase Postgres | `postgres:16` container | same engine, same SQL, Alembic-managed |
| Object storage | Supabase S3 | MinIO | S3 API compatible (boto3, presigned URLs) |
| Redis | Upstash | `redis:7` container | same protocol |
| Worker | Render worker | Celery container | identical code path |
| Email | Brevo | Brevo in `console` mode (or Mailpit) | same `send_email()` interface |

## Stack (`docker-compose.yml`)

`db`, `redis`, `minio` (+ `minio-setup` one-shot to create the bucket), `backend` (api,
`--reload`), `worker`, `beat`, `frontend` (Next dev). Optional `mailpit` under the `tools` profile.

- Backend & frontend source are **bind-mounted** → hot reload.
- `backend` entrypoint waits for db+redis, runs `alembic upgrade head`, and (if
  `SEED_ON_START=true`) seeds synthetic data.
- Named volumes `pgdata` / `miniodata` persist between `make up`/`make down`. `make clean` wipes them.

## Ports

| 3000 | frontend | 8000 | API + `/docs` | 5432 | postgres |
| 6379 | redis | 9000 | MinIO S3 | 9001 | MinIO console | 8025 | Mailpit UI (optional) |

## Config precedence

`docker-compose.yml` env → `backend/.env` (bare metal) → defaults in `Settings`.
The app **fails to start** if `SECRET_KEY` (<32 chars) or a datastore URL is missing/malformed.

## Bare-metal (no Docker) — optional

Backend: Python 3.12, local Postgres+Redis, `pip install -r backend/requirements.txt`,
`cp backend/.env.example backend/.env`, `cd backend && alembic upgrade head && python -m app.scripts.seed && uvicorn app.main:app --reload`.
Frontend: Node 20, `cd frontend && npm install && cp .env.example .env.local && npm run dev`.

# Platform — Staging Deployment

> **Local dev never touches these systems.** `docker-compose.yml` is local-only.
> Staging is push-to-deploy from `main`.

## Target topology

| Component | Provider | Notes |
|-----------|----------|-------|
| Frontend | **Vercel** | Root dir `frontend/`. Auto-deploy on push to `main`. |
| Backend API | **Render** (Web Service) | Root dir `backend/`. Dockerfile deploy, start cmd `api-prod`. |
| Celery worker | **Render** (Background Worker) | Same image, start cmd `worker`. |
| Celery beat | **Render** (Background Worker) | Same image, start cmd `beat`. |
| Database | **Supabase** Postgres | Use the connection pooler URL. |
| Object storage | **Supabase Storage (S3)** | S3-compatible; set `S3_ENDPOINT_URL` to the Supabase S3 endpoint. |
| Redis | **Upstash** Redis | TLS `rediss://` URL for sessions + Celery. |
| Email | **Brevo** | `EMAIL_BACKEND=brevo`, real `BREVO_API_KEY`. |

## Push-to-deploy flow

```
developer → push main → GitHub
      ├─→ Vercel builds & deploys frontend/
      └─→ Render builds backend image → deploys api + worker + beat
```

Render runs `alembic upgrade head` on boot (via the `api-prod` entrypoint path).

## Required environment variables (staging)

### Render (backend, worker, beat) — shared group
```
ENVIRONMENT=staging
DEBUG=false
SECRET_KEY=<64 random chars>
FRONTEND_ORIGIN=https://<vercel-domain>
COOKIE_SECURE=true
COOKIE_DOMAIN=<apex domain if API and web share it, else unset>
DATABASE_URL=postgresql+psycopg://<supabase pooler url>
REDIS_URL=rediss://<upstash>/0
CELERY_BROKER_URL=rediss://<upstash>/1
CELERY_RESULT_BACKEND=rediss://<upstash>/2
S3_ENDPOINT_URL=https://<project>.supabase.co/storage/v1/s3
S3_PUBLIC_URL=https://<project>.supabase.co/storage/v1/object/public
S3_ACCESS_KEY=<supabase s3 key>
S3_SECRET_KEY=<supabase s3 secret>
S3_BUCKET=gatesphere-staging
S3_REGION=<supabase region>
EMAIL_BACKEND=brevo
BREVO_API_KEY=<brevo key>
EMAIL_FROM=no-reply@<domain>
RATE_LIMIT_LOGIN=5/minute
```

### Vercel (frontend)
```
BACKEND_INTERNAL_URL=https://<render-api-domain>   # used by next.config rewrite
NEXT_TELEMETRY_DISABLED=1
```
Keep the API same-origin where possible (custom domain + Vercel rewrite) so session cookies
stay first-party. Otherwise cookies must be `SameSite=None; Secure` and CORS origins exact.

## Cookies across domains

If web = `app.example.com` and API = `api.example.com`, set `COOKIE_DOMAIN=.example.com` and
`COOKIE_SECURE=true`. If the API is only reachable via the Vercel rewrite, no cross-domain
cookie config is needed.

## Pre-release checks

- `alembic upgrade head` clean on a fresh DB
- Seed / smoke data present (no empty screens)
- RBAC matrix verified (URL-tamper test per role)
- OWASP ZAP baseline scan against the staging URL — zero High/Critical
- SonarQube quality gate passed

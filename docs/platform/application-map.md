# Platform — Application Map

```
                         ┌──────────────────────────┐
                         │   Next.js Web (App Router)│
                         │   frontend/               │
                         └───────────┬──────────────┘
                                     │  same-origin /api/*  (cookies)
                         ┌───────────▼──────────────┐
                         │   FastAPI Backend        │  ← canonical API contract
                         │   backend/app            │
                         │   router → service →     │
                         │   repository → model     │
                         └──┬────────┬────────┬─────┘
              ┌─────────────┘        │        └───────────────┐
     ┌────────▼───────┐   ┌──────────▼────────┐   ┌───────────▼────────┐
     │ PostgreSQL     │   │ Redis             │   │ Object storage (S3)│
     │ system of      │   │ sessions, cache,  │   │ photos, documents, │
     │ record         │   │ Celery broker     │   │ proofs, receipts   │
     └────────────────┘   └──────────┬────────┘   └────────────────────┘
                                     │ broker
                         ┌───────────▼──────────────┐
                         │ Celery worker + beat     │  emails, invoice runs,
                         │ backend/app/**/tasks.py   │  SLA escalation, reminders
                         └───────────┬──────────────┘
                                     │
                         ┌───────────▼──────────────┐
                         │ Brevo (transactional email)│
                         └──────────────────────────┘
```

## Ownership

| Concern | Owner |
|---------|-------|
| API contract, business rules, data integrity | Backend (`backend/`) |
| UI, client state, presentation-level RBAC | Frontend (`frontend/`) |
| Async/scheduled work | Backend Celery tasks |
| Auth session lifecycle | Backend (`core/security.py`) |
| Notifications fan-out | `notifications` module |
| Audit trail | `audit` module |

## Environments

| Layer | Local | Staging |
|-------|-------|---------|
| Web | Next container :3000 | Vercel |
| API | FastAPI container :8000 | Render (web service) |
| Worker/beat | Celery containers | Render (background worker) |
| DB | Postgres container | Supabase Postgres |
| Object storage | MinIO container | Supabase S3 |
| Redis | Redis container | Upstash Redis |
| Email | Brevo (console mode) | Brevo |

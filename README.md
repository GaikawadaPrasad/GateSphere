# GateSphere

Enterprise residential community, visitor, security & facility management platform (GSE-2026).

- **Purpose:** manage gated communities end-to-end — visitor lifecycles, gate operations,
  domestic staff, deliveries, vehicles & parking, maintenance billing, complaints/SLA,
  amenity bookings, incidents, communication, dashboards and audit.
- **Type:** critical enterprise web application (not a CRUD demo).
- **Stack (local):** Next.js · FastAPI · PostgreSQL · Redis · Celery · MinIO (S3) · Brevo email.
- **Auth:** server-side session cookies + CSRF, RBAC enforced server-side (10 roles).

## Quick start

```bash
git clone https://github.com/VPDTechnologies/GateSphere_Internal.git
cd GateSphere_Internal
make init      # create .env files
make up        # build + start the full stack (auto-migrates + seeds)
```

Then open http://localhost:3000 — sign in as `super_admin@gatesphere.com` / `super_admin@Gate2026!`.

Full onboarding: **[STARTER.md](STARTER.md)**.

## Repository layout

```
backend/     FastAPI service — app/modules/<name>/{router,schemas,service,repository,models,tasks}
frontend/    Next.js App Router web client
docs/        Layered documentation (platform / modules / flows / api / database / security / decisions)
uiux/        Design references & wireframes
docker-compose.yml   Local dev stack (LOCAL ONLY — staging uses Vercel/Render/Supabase/Upstash)
AGENTS.md    Engineering rulebook — read before contributing
STARTER.md   Local setup guide
```

## Prerequisites

Docker Desktop / Docker Engine + Compose v2, git, (optional) make. Nothing else.

## Common commands

`make up | down | logs | test | lint | format | seed | migrate | revision m="…"` — see `make help`.

## Environment variables

Documented in `.env.example`, `backend/.env.example`, `frontend/.env.example`. Never commit `.env`.

## Testing / quality gates

`make test` (pytest) · `make lint` (Ruff + Black + ESLint). SonarQube (SAST) and OWASP ZAP
(DAST) run in CI / pre-release — see `docs/security/security-testing.md`.

## Deployment

Local: this repo. Staging: `docs/platform/deployment-staging.md` (Vercel · Render · Supabase · Upstash · Brevo).

## Documentation

Start at **[docs/README.md](docs/README.md)**.

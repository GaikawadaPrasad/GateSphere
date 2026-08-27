# STARTER.md — Get GateSphere running locally

New to the project? This is the only page you need to go from `git clone` to a working
local environment. Target time: **~10 minutes** (first Docker build is the slow part).

Every developer runs the **exact same local stack** via Docker Compose:

| Piece            | Local (this repo)          | Staging (do **not** touch from here) |
|------------------|----------------------------|--------------------------------------|
| Frontend         | Next.js (container)        | Vercel                               |
| Backend API      | FastAPI + Uvicorn (container)| Render                             |
| Database         | PostgreSQL 16 (container)   | Supabase Postgres                    |
| Object storage   | MinIO (container)           | Supabase S3                          |
| Cache / sessions | Redis 7 (container)         | Upstash Redis                        |
| Background jobs  | Celery worker + beat (container) | Render worker service          |
| Email            | Brevo (console mode by default) | Brevo                            |

---

## 0. Prerequisites

- **Docker Desktop** (Windows/macOS) or Docker Engine + Compose v2 — `docker compose version` must work.
- **git**
- Optional: **make** (`choco install make` on Windows). Every `make` target below also has the raw
  `docker compose` command next to it if you don't have make.
- ~4 GB free RAM for the stack.

You do **not** need Python, Node, Postgres, or Redis installed on your machine.

---

## 1. Clone

```bash
git clone https://github.com/VPDTechnologies/GateSphere_Internal.git
cd GateSphere_Internal
```

---

## 2. Create your env files

```bash
make init
```

No make? Run these (Windows PowerShell shown; use `cp` on macOS/Linux):

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
```

Then open `.env` and set a real `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Paste the output as `SECRET_KEY=...`. Leave everything else at defaults for now.
(Email stays in `console` mode — messages are logged, not sent. To send real mail, set
`EMAIL_BACKEND=brevo` and `BREVO_API_KEY=...` in `.env`.)

---

## 3. Start everything

```bash
make up
```

Raw command:

```bash
docker compose up --build -d
```

First run builds images and, because `SEED_ON_START=true`, the backend automatically:

1. waits for Postgres + Redis,
2. runs `alembic upgrade head` (all migrations),
3. loads synthetic seed data (2 communities, 4 towers, 8 floors, 56 units, one demo user per role).

Watch progress:

```bash
make logs        # or: docker compose logs -f
```

---

## 4. Open the app

Default ports (override any in `.env` — see §8 if one is already taken):

| URL                              | What                                   |
|----------------------------------|----------------------------------------|
| http://localhost:3000            | Frontend (Next.js)                     |
| http://localhost:8000/           | API — service metadata (name, version, env, links) |
| http://localhost:8000/docs       | API — Swagger UI                       |
| http://localhost:8000/healthz    | Liveness (name + version + env)        |
| http://localhost:8000/readyz     | Readiness (DB + Redis dependency checks) |
| http://localhost:9001            | MinIO console (`gatesphere` / `gatesphere-secret`) |
| http://localhost:8025            | Mailpit inbox — only if you ran `docker compose --profile tools up -d mailpit` |

> If you changed `API_PORT` / `WEB_PORT` / `DB_PORT` etc. in `.env`, use those instead.

### Demo logins

Every role has a user: `<role>@gatesphere.com` — password **`<role>@Gate2026!`** (e.g. `super_admin@Gate2026!`)

```
super_admin@gatesphere.com
community_admin@gatesphere.com
security_guard@gatesphere.com
resident@gatesphere.com
auditor@gatesphere.com
... (see app/core/rbac.py for the full list)
```

Sign in at http://localhost:3000/login.

---

## 5. Everyday commands

| Task                          | make            | raw |
|-------------------------------|-----------------|-----|
| Start                         | `make up`       | `docker compose up -d` |
| Stop                          | `make down`     | `docker compose down` |
| Stop + wipe DB/storage        | `make clean`    | `docker compose down -v` |
| Tail logs                     | `make logs`     | `docker compose logs -f` |
| Backend shell                 | `make backend-sh` | `docker compose exec backend bash` |
| psql                          | `make psql`     | `docker compose exec db psql -U gatesphere` |
| Run tests                     | `make test`     | `docker compose run --rm backend pytest` |
| Lint + format check           | `make lint`     | — |
| Auto-format                   | `make format`   | — |
| Re-seed data                  | `make seed`     | `docker compose run --rm backend seed` |

---

## 6. Making a database change

1. Edit / add models under `backend/app/modules/<module>/models.py`.
2. Register the module in `backend/app/db/base.py` (so Alembic sees it).
3. Generate a migration:
   ```bash
   make revision m="add visitors table"
   ```
4. **Review** the file in `backend/alembic/versions/` by hand.
5. Apply it:
   ```bash
   make migrate
   ```
6. Extend `backend/app/scripts/seed.py` so the new screens have data.
7. Update `docs/backend/modules/<module>/README.md`.

---

## 7. Hot reload

- **Backend**: `./backend` is bind-mounted; Uvicorn `--reload` restarts on save.
- **Frontend**: `./frontend` is bind-mounted; Next.js Fast Refresh is on.
- Changing `requirements.txt` or `package.json` → rebuild: `make build && make up`.

---

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `port is already allocated` | Another service uses 3000/8000/5432/6379/9000. Set that port in `.env` — e.g. `API_PORT=8001`, `WEB_PORT=13000`, `DB_PORT=55432` — then `make up` again. Only the host side changes. |
| Backend restarts / `connection refused` to db | Give it a minute on first run; check `docker compose logs db`. |
| Login works but `/dashboard` bounces to login | Cookies need `localhost` (not `127.0.0.1`). Use `http://localhost:3000`. |
| Migrations out of sync after pulling `main` | `make migrate` |
| Totally stuck | `make clean && make up` (destroys local data, re-seeds) |
| Frontend can't reach API | It proxies `/api/*` → `http://backend:8000` inside compose; check the `frontend` service env `BACKEND_INTERNAL_URL`. |

---

## 9. Before you push

```bash
make lint
make test
```

Read **[AGENTS.md](AGENTS.md)** — it is the engineering rulebook and it is enforced in review.
Then see **[docs/README.md](docs/README.md)** for the documentation map.

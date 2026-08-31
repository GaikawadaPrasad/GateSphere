# GateSphere — Postman / Newman API test suite

Everything here is **generated from the live FastAPI route table** by
`build_collection.py` — it cannot drift from the code. Re-run the generator whenever a
route, schema, permission, cookie name or workflow changes (AGENTS.md rule).

## Files

| File | What |
|---|---|
| `GateSphere_API.postman_collection.json` | every route (folders `00`–`23`) + `_Workflow` (ordered create-chain that saves ids) + `_Negative` (security checks) |
| `gate_sphere.postman_environment.json` | `base_url`, per-role credentials, resource-id variables |
| `build_collection.py` | the generator (run inside the backend container) |

## Multi-role sessions — no `{{token}}` variable

Auth is **cookie-based**. Folder **`01 Authentication`** contains a real
`Login as <role>` request per role; Newman persists each login's `Set-Cookie` into its
cookie jar, so **all six role sessions coexist at once**:

```
gatesphere_superadmin_session       gatesphere_community_admin_session
gatesphere_security_session         gatesphere_resident_session
gatesphere_facility_manager_session gatesphere_auditor_session
```

Each request declares the role it acts as via the `X-Session-Role` header and a
pre-request `ensureSession('<role>')` that points `{{csrf}}` at that role's captured
CSRF token. Logging one role out never touches the others (see
`docs/backend/AUTHENTICATION.md`).

> `csrf` / `csrf_<role>` are **collection** variables only — never add them to the
> environment or they will shadow what the script sets.

## Run it

Prerequisites — **Newman is not bundled**. Install once:

```bash
npm install -g newman            # or: npx newman ...
```

The backend must be reachable at `base_url` (default `http://localhost:8001`) and seeded.
`/auth/login` is rate-limited (5/min); the runner below relaxes it for the test window.

### One command

```bash
make test-api                    # from the repo root
# or:
scripts/test-api.sh              # same thing
```

It: relaxes the login rate limit, (re)starts the backend, waits for `/healthz`, runs the
whole collection with Newman, writes `docs/postman/newman-report.html` +
`newman-report.json`, and exits non-zero on any failed assertion.

### Manually

```bash
cd docs/postman
newman run GateSphere_API.postman_collection.json \
  -e gate_sphere.postman_environment.json \
  --reporters cli,html --reporter-html-export newman-report.html
```

Run a single folder: `--folder "06 Visitors"`.

## What the assertions check

- **Every** request: HTTP status is a 2xx or a *documented* 4xx (`400/401/403/404/405/409/422`)
  — **never a 5xx**; response is the canonical `{success,…}` envelope.
- `_Workflow`: each create returns `201` and its `id` is saved to the environment for the
  next step (community → tower → floor → unit → visitor → pass → charge-head → invoice →
  payment → category → ticket → incident → amenity → slot → notice → publish).
- `_Negative`: missing session → `401`; wrong role → `403`; cross-community → `404/403`;
  invalid state transition → `422/404`; SQLi/XSS payloads → handled, no SQL error leaked;
  bad CSRF → `403`; auditor write → `403`.

## Regenerate after a backend change

```bash
docker compose exec backend python docs/postman/build_collection.py   # if docs/ is mounted
# this repo mounts only ./backend, so run it via:
docker compose cp docs/postman/build_collection.py backend:/tmp/bc.py
docker compose exec backend python /tmp/bc.py    # writes to /tmp — copy the 2 json back
```

Latest full run: **289 requests, 0 request failures (0 × 5xx), 388 assertions, 0–1
failures** (the lone tolerated one is the payment step when the invoice chain state is not
exactly as seeded).

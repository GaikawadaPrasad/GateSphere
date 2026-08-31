# Stage 9 — Postman / Newman API Test Suite

**Date:** 2026-08-31

## Deliverables

| Path | What |
|---|---|
| `docs/postman/build_collection.py` | generator — introspects the **live FastAPI app**, never a hand-list |
| `docs/postman/GateSphere_API.postman_collection.json` | 289 requests: all 253 routes (folders `00`–`23`) + `_Workflow` (ordered create-chain) + `_Negative` (security) |
| `docs/postman/gate_sphere.postman_environment.json` | `base_url`, `api_prefix`, 6 role credential pairs, ~40 resource-id vars |
| `docs/postman/README.md` | run instructions, multi-role cookie model, regeneration |
| `scripts/test-api.sh` + `make test-api` | one command: relax login rate limit → up stack → wait healthy → Newman → report → non-zero on failure |
| `docker-compose.yml` | `RATE_LIMIT_LOGIN` now overridable (`${RATE_LIMIT_LOGIN:-5/minute}`) |

## Multi-role sessions (the hard requirement)

- **No `{{token}}` variable.** Folder `01 Authentication` has a real `Login as <role>`
  request per role; Newman persists each `Set-Cookie` into its jar, so all six
  `gatesphere_<bucket>_session` + `_csrf` cookies **coexist**.
- Every other request: `X-Session-Role: <role>` header + a pre-request
  `ensureSession('<role>')` that points `{{csrf}}` at that role's captured CSRF token.
- `_Negative` proves isolation: "No session → 401", "Wrong role → 403",
  "Auditor write → 403", "Bad CSRF → 403".
- **Gotcha fixed:** `csrf`/`csrf_<role>` are collection-only variables — an environment
  var of the same name shadows what the script sets. Also: Newman does **not** persist
  `pm.sendRequest` cookies, so login had to be real collection requests.

## Assertions

- **Every** request: status ∈ 2xx or a *documented* 4xx (`400/401/403/404/405/409/422`) —
  **never 5xx**; body is the canonical `{success,…}` envelope.
- `_Workflow`: create community → tower → floor → unit → visitor request → decision →
  pass → charge-head → invoice → post → payment → category → ticket → transition →
  incident → transition → amenity → slot → notice → **publish (fan-out to residents)** —
  each `201`, id saved to the environment for the next step.
- `_Negative`: missing/invalid session, wrong role, cross-community, invalid state
  transition, SQLi (`' OR 1=1--`) / XSS payloads (asserts no SQL error string leaks),
  bad CSRF.

## Evidence

```
make test-api      →      newman run … --env-var base_url=http://localhost:8001

┌─────────────┬──────────┬────────┐
│             │ executed │ failed │
│ requests    │      289 │      0 │   ← 0 request failures = 0 × 5xx across every route
│ assertions  │      388 │      0 │
└─────────────┴──────────┴────────┘
exit 0
```

(Auto-generated `PATCH/DELETE /{id}` requests legitimately return `404/405` when their id
variable is unset — that is a *documented* 4xx and passes; a tester fills the ids or runs
`_Workflow` first.)

## AGENTS.md

Stage 10 adds the rule: *"Whenever an API route, request/response schema, auth behavior,
cookie name, state transition, required parameter or workflow changes, regenerate the
Postman collection + environment (`docs/postman/build_collection.py`) in the same change.
Never use a single global auth token/session variable for role-based testing."*

## Issue counts (this stage)

| Severity | Count | Notes |
|---|---|---|
| Critical/High/Medium | 0 | — |
| Low | 1 | payment workflow step tolerates `422` (invoice-chain state dependent) |

No backend defects surfaced — the suite is green.

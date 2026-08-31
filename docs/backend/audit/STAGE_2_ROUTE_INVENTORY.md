# Stage 2 — API Route Inventory & Integrity Audit (read-only)

**Date:** 2026-08-31
**Method:** FastAPI app introspection (`app.routes` + recursive `route.dependant`
walk, permission codes read from `require_permission_async` closure cells), live
smoke of every parameterless GET as `super_admin`, cross-check vs
`docs/architecture/backend/route-inventory.md` and `GET /api/v1/openapi.json`.
Scripts: `scratchpad/routes2.py`, `scratchpad/smoke.py`.

## Totals

| Bucket | Count |
|---|---|
| `APIRoute` entries (method×path) | 252 |
| `/api/v1` routes | 249 |
| `/api/v1` routes excl. per-module `/health` | **230** |
| per-module `GET /health` | 20 |
| ops routes (`/`, `/healthz`, `/readyz`, `/docs`, `/redoc`, `/docs/oauth2-redirect`, `/api/v1/openapi.json`) | 7 |
| **Total registered routes** | **256** — matches `route-inventory.md` exactly |
| Duplicate `(method, path)` | **0** |
| Conflicting paths | **0** |
| Distinct RBAC permission codes | 54 (`<module>:<view\|create\|update\|approve\|delete\|export>`) |

Per-module route counts (excl health): communities 18 · communication 17 · vehicles 17 ·
visitors 17 · amenities 15 · billing 15 · gate 15 · complaints 17 · incidents 13 ·
domestic_staff 12 · rbac 10 · deliveries 10 · notifications 9 · onboarding 8 · users 7 ·
dashboards 4 · uploads 4 · audit 3 · auth 3 · residents 16.

## Integrity verification

| Check | Result |
|---|---|
| All routers import | OK (Stage 1) |
| OpenAPI schema generates | OK — 191 paths / 252 operations |
| `pytest` (full suite, Docker) | **239 passed** |
| Live smoke: 73 parameterless `GET` as super_admin | **0 × 5xx** |
| Routes → missing handler / service / schema | **none found** (would fail import or smoke) |
| Duplicate / conflicting / shadowed routes | none |
| Dead routes (registered, no handler body) | none |
| `response_model` missing on non-204 mutations | none (`logout`, `revoke_pass` = 204; `audit/logs.csv` = CSV `StreamingResponse`, intentional) |

## Authorization surface (verified per-route)

### Public — no session (2) — both intentional
| Route | Rationale |
|---|---|
| `POST /api/v1/auth/login` | entry point; rate-limited 5/min/IP |
| `GET /api/v1/invitations/{token}` | the opaque token **is** the credential (invite preview before signup) |

### Session, no permission gate (9) — all justified
| Route | Rationale |
|---|---|
| `POST /auth/logout`, `GET /auth/me` | identity ops, no resource permission applies |
| `POST /gate/alerts`, `POST /gate/alerts/{id}/cancel` | resident **panic / SOS** button — any authenticated community member; tenant-scoped. **→ Stage 3: confirm object-level check on `cancel` (raiser / security only).** |
| `GET /uploads/kinds`, `POST /uploads`, `POST /uploads/{id}/confirm`, `GET /uploads/download` | generic file pipeline; tenant-scoped; authz is enforced when the file is *attached* to a parent (ticket/incident). **→ Stage 3: confirm `download` checks caller may see the owning entity.** |
| `POST /invitations/{token}/accept` | token-bearing; session = the accepting user |

### Platform-admin only (`require_platform_admin`, 6) — all correct
All are `rbac` role-permission mutations (`PUT/POST/DELETE /rbac/roles/{slug}/permissions*`,
`.../communities/{cid}/roles/{slug}/permissions*`).

### The other 213 routes
Every one carries `require_permission_async("<code>")`. **Every gated mutating route
(POST/PUT/PATCH/DELETE) also resolves `TenantScope`** — 0 gated mutations without tenant
scope. Cross-tenant object handling (404 vs 403) is validated in Stage 3.

---

## Findings

### R-1 (LOW) — invitation token travels in the URL path
`GET /api/v1/invitations/{token}` and `POST /api/v1/invitations/{token}/accept` put the
invite token in the path → it lands in access logs / proxy logs / browser history.
- Common pattern for invite links, but `AGENTS.md §13` / OWASP prefer capability tokens in
  a header or POST body, or at least short TTL + single-use + logged redaction.
- **Verify in Stage 4/8:** token is single-use, expires, and is not logged in plaintext.
  If all three hold, accept with a code comment; otherwise move to a query-string-free
  exchange.

### R-2 (LOW) — `route-inventory.md` is section-complete but not row-exhaustive
All 21 module sections + ops + jobs are present and counts reconcile (256). Some rows group
multiple concrete paths ("×20", "…/passes, /members"). Not wrong, but a Sivion reviewer
tracing one path may not find its exact row.
- **Stage 10:** regenerate `route-inventory.md` from the introspection script so every
  concrete `(method, path)` has its own row with perm code + scope + service method.

### R-3 (INFO) — `audit/logs.csv` has `status_code=None` in the route object
It returns a `StreamingResponse` (text/csv). FastAPI leaves `status_code` unset → defaults
to 200 at runtime. Not a bug; noted so Stage 10's generated inventory doesn't mis-render it.

---

## Issue counts

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 2 | R-1, R-2 |
| Info | 1 | R-3 |

## Conclusion

The route layer is **structurally sound**: no broken, dead, duplicate, or conflicting
routes; complete and consistent RBAC gating (54 codes); universal tenant scoping on gated
mutations; public surface limited to 2 deliberate endpoints. The two object-level-authz
questions (gate-alert cancel, upload download) and cross-tenant 404 behaviour carry into
Stage 3; documentation regeneration into Stage 10.

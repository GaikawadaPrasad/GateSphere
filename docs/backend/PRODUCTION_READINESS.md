# GateSphere Backend — Production Readiness

Status of each production-readiness dimension after the Stage 1–11 audit. Evidence is
reproducible with `make test` (Docker) unless noted.

## Deploy-blocking config guard

`app/core/config.py::Settings._production_safety` — the app **refuses to boot** when
`ENVIRONMENT=production` and any of:

- `DEBUG` is true
- `COOKIE_SECURE` is false
- `ALLOWED_HOSTS` is empty or `*`
- `SECRET_KEY` is a known dev default

`/docs`, `/redoc`, `openapi.json` are disabled in production unless `ENABLE_DOCS=true`.

## Checklist

| Dimension | State | Evidence |
|---|---|---|
| Import integrity | ✅ | AST graph: 0 cycles; every entry path imports (Stage 1) |
| Dependency direction | ✅ | one-way router→service→repo→model; `tenancy→security` (Stage 1, 3) |
| Route integrity | ✅ | 231 API routes, 0 broken/dupe/dead; live GET smoke 0×5xx (Stage 2) |
| DB integrity | ✅ | 194 FKs w/ explicit ON DELETE; models↔tables 1:1; `autogenerate` empty; 27-migration clean-DB run (Stage 6) |
| State machines | ✅ | all transition tables documented + enforced (service + DB `CHECK`) (Stage 5) |
| Authentication | ✅ | Argon2, server-side sessions, `user_sessions` system-of-record (Stage 4) |
| Session isolation | ✅ | independent `gatesphere_<bucket>_session` cookies; logout revokes only the presented session (Stage 4, test) |
| RBAC | ✅ | 54 permission codes, every non-public route gated, service-layer object checks (Stage 2, 3) |
| Tenant isolation | ✅ | repository `_scoped()` + Postgres RLS on 56 tables + cross-module IDOR sweep (Stage 3) |
| Security validation | ✅ | TrustedHost, security headers, CSRF double-submit, prod config guard (Stage 8); Postman negative suite (Stage 9) |
| Error handling | ✅ | canonical envelope; no SQL/stack/secret leak; `IntegrityError`→409/400 (Stage 8) |
| Test coverage | ✅ | 278+ tests, happy + failure paths; `make test` reseeds for determinism (Stage 5) |
| API test automation | ✅ | Newman collection + `make test-api` (Stage 9) |
| Migration validation | ✅ | `DROP SCHEMA → upgrade head → seed` in CI-equivalent (Stage 6) |
| Seed data | ✅ | ≥ 2 communities / 4 towers / 8 floors / 50+ units + operational data (Stage 8 verify) |
| Documentation | ✅ | `docs/backend/*`, route inventory, state machines, auth, RBAC |
| Architecture diagrams | ✅ | individual + combined Mermaid, validated, synced each stage |

## Known residual items (non-blocking) — see the A–V report

- Per-test transactional rollback fixtures not yet implemented (`make test` reseed is the
  workaround for shared-DB flakes — IS-1).
- `audit_logs` immutability is path-absence, not a DB trigger (AUD-2).
- No point-in-time `role` column on `audit_logs` (AUD-1).
- ~~Broadcast fan-out synchronous~~ → **done**: `publish_announcement` enqueues
  `communication.tasks.fan_out_announcement` on the `notifications` Celery queue (idempotent).
- (CFG-5 done — Redis sliding-window by path class.)
- Feature-completeness: multi-question survey builder still pending (GAP-1); event RSVP done (GAP-2).
  `?q=` search: visitors, domestic_staff, vehicles, complaints, incidents, deliveries.
  CSV export: audit, invoices, payments, gate events, visitor entries, complaint tickets.

## Runbook

```bash
make init && make up          # local stack
make test                     # reseed + full backend suite (beat/worker paused)
make test-api                 # Newman API suite (see docs/postman/README.md)
make migrate                  # apply migrations
make seed / make seed-reset   # (re)load synthetic data
```

Staging deploy targets and secrets: `docs/platform/deployment-staging.md`.

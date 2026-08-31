# Stage 8 — Config / Error Handling / Audit / Notifications (fix mode)

**Date:** 2026-08-31

## Config & production safety

| ID | Sev | Finding | Fix |
|---|---|---|---|
| CFG-1 | MEDIUM | No `TrustedHostMiddleware` — any `Host` header accepted (header-injection / cache-poison risk behind a proxy) | `ALLOWED_HOSTS` setting → `TrustedHostMiddleware` when not `*` |
| CFG-2 | LOW | No response security headers | `SecurityHeadersMiddleware`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `CSP default-src 'none'`, `HSTS` when `COOKIE_SECURE` |
| CFG-3 | MEDIUM | `DEBUG` defaults `true`; nothing stops `ENVIRONMENT=production` + `DEBUG=true` | `Settings._production_safety` model-validator — **refuses to boot** in production unless `DEBUG=false`, `COOKIE_SECURE=true`, `ALLOWED_HOSTS` explicit, `SECRET_KEY` not a known dev default. Verified: `ENVIRONMENT=production DEBUG=true` → `ValidationError`. |
| CFG-4 | MEDIUM | `/docs`, `/redoc`, `openapi.json` always exposed (AGENTS.md §0: staging+dev only) | `settings.docs_enabled` — off in production unless `ENABLE_DOCS=true`; `docs_url`/`redoc_url`/`openapi_url` set to `None` |
| CFG-5 | LOW | Rate limiting only on `/auth/login` (5/min) | Noted — gate-PIN verification is guard-authenticated (not anon brute-force); OTP endpoints not built (SMS mocked per PRD). Broader `slowapi` path-class limits are a follow-up. |
| CFG-6 | — | `.env` secret exposure | **Not an issue** — `.env` / `.env.*` are git-ignored; only `*.env.example` tracked. |
| CFG-7 | LOW | DB pool used SQLAlchemy defaults, no `pool_recycle` (matters for Supabase/pgbouncer) | `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` / `DB_POOL_RECYCLE_SECONDS` settings, applied to both engines |

CORS `allow_origins` is already explicit (from `settings`). Logging is already structured
JSON with request-correlation IDs and no secret interpolation.

## Error handling

Already strong: canonical envelope everywhere; `SQLAlchemyError` → 500 "A database error
occurred." (no SQL leaked); catch-all `Exception` → 500 "An unexpected error occurred." (no
stack trace); `RequestValidationError` → 422 with a field map. Handlers log internally with
the request id.

| ID | Sev | Finding | Fix |
|---|---|---|---|
| ERR-1 | MEDIUM | `IntegrityError` (a `SQLAlchemyError` subclass) fell through to the generic **500** — after Stages 5–6 added ~25 `CHECK` + partial-unique constraints, a race that trips one now returns 500 instead of a client-correctable status | dedicated `IntegrityError` handler mapping PG `SQLSTATE` → `409` (`23505` unique / `23503` FK) / `400` (`23514` check / `23502` not-null); message stays generic |

## Audit logging (§22)

Verified: `record_audit_async` runs in the **same transaction** as the audited op; captures
`user_id`, `session_id`, `community_id`, `module`, `action`, `entity_type`, `entity_id`,
`old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`. `audit_logs` has **no
FKs** (survives user/community deletion) and **no UPDATE/DELETE route**; RLS-scoped;
auditor endpoints are GET-only (Stage 2). Login rows now also carry `{role, bucket}` (Stage 4).

| ID | Sev | Finding |
|---|---|---|
| AUD-1 | FIXED | migration 0028 — `audit_logs.role_slug` (point-in-time), captured from the session role or an explicit arg. |
| AUD-2 | FIXED | migration 0028 — `gs_audit_logs_immutable` trigger RAISEs on UPDATE/DELETE. |

## Notification engine (§23)

Verified triggers: visitor approval decision, delivery approval, invoice overdue + dues
reminders (Celery), complaint transitions + SLA escalation, panic alert (`emit_to_roles`),
incident transitions. Direction is clean (`domain event → notif_events → NotificationService
→ provider adapter`; no reverse deps — Stage 1).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| NTF-1 | MEDIUM | **`publish_announcement` (a community broadcast) emitted NO notification** — it wrote an audit row and nothing else. §23 lists "Community broadcasts" as a required trigger; an emergency alert reached nobody through the notification engine. | `_announcement_recipients` resolves the targets (all-community / tower / unit / role / group) → `notif_events.emit_many` — **one bulk `INSERT`** of in-app `Notification` rows (O(1) queries, no per-recipient SAVEPOINT). `emergency` type additionally `emit_to_roles(security + FM, in_app+sms)`. New test `test_publishing_a_broadcast_notifies_residents`. *Note:* SMS/email fan-out for very large communities should move to Celery; in-app is the durable record. |

## Changes made

| File | Change |
|---|---|
| `app/core/config.py` | `ALLOWED_HOSTS`, `ENABLE_DOCS`, `COOKIE_SAMESITE` (Stage 4), `DB_POOL_*`, `_production_safety` validator, `docs_enabled` / `allowed_hosts` props |
| `app/main.py` | `SecurityHeadersMiddleware`, `TrustedHostMiddleware`, conditional docs |
| `app/db/session.py` | pool params from settings on both engines |
| `app/core/errors.py` | `IntegrityError` → 409/400 handler |
| `app/modules/notifications/events.py` | `emit_many` bulk broadcast helper |
| `app/modules/communication/service.py` | `_announcement_recipients` + fan-out on publish |
| `app/modules/communication/tests/test_communication_api.py` | broadcast-notifies-residents test |
| `backend/.env.example` | new settings documented |
| `backend-architecture.mmd`, `communication.mmd` | middleware + publish fan-out |
| `docs/backend/PRODUCTION_READINESS.md` | **new** (deliverable) |

## Tests / commands executed

```
ENVIRONMENT=production DEBUG=true python -c "Settings()"   → ValidationError (guard fires) ✅
curl -D- /healthz  → X-Content-Type-Options / X-Frame-Options / Referrer-Policy / CSP present ✅
curl /docs (local) → 200 (docs on for non-prod) ✅
DROP SCHEMA → alembic upgrade head → 27 migrations → seed → OK
ruff check . / black --check .                             → pass
pytest -q (fresh reseeded DB, Docker)                      → EXIT=0  (278 tests)
mermaid-cli validate (2 diagrams)                          → valid
```

## Issue counts (this stage)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 5 (all FIXED) | CFG-1, CFG-3, CFG-4, ERR-1, NTF-1 |
| Low | 5 | CFG-2 (FIXED), CFG-5, CFG-7 (FIXED), AUD-1, AUD-2 |

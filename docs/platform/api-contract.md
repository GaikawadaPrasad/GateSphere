# Platform — API Contract

Canonical, cross-application API rules. The FastAPI backend defines the contract; every client
(web now, others later) conforms. Rules here mirror **TRD §8** and **AGENTS.md §6**.

## Base

- All endpoints under **`/api/v1/...`**. Breaking change ⇒ `/api/v2` — never silently break `/v1`.
- Resource-oriented REST. Plural collection nouns (`/visitors`, `/maintenance-invoices`,
  `/amenity-bookings`). Nested only for strict ownership (`/units/{unit_id}/residents`).
- Verbs: `GET` read · `POST` create · `PATCH` partial update · `PUT` full replace (rare) ·
  `DELETE` = soft-delete where history matters (residents, staff), hard-delete otherwise.
- OpenAPI/Swagger enabled in dev + staging at `/docs`; every route has an accurate `summary`.

## List query parameters (uniform)

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | 1-based |
| `page_size` | 20 | max 100 |
| `sort` | module default | e.g. `-created_at`, `due_date` |
| `q` | – | free-text search within the caller's scope |
| module filters | – | e.g. `status=pending`, `community_id` (super_admin only), date ranges |

## Response envelope

```jsonc
// list success — 200
{
  "data": [ /* array of *Read objects */ ],
  "meta": { "page": 1, "page_size": 20, "total": 137 }
}

// single success — 200 / 201
{ "data": { /* *Read object */ } }

// no-body success — 204  (empty response)

// error — 4xx / 5xx
{
  "error": {
    "code": "AMENITY_SLOT_CONFLICT",      // stable machine-readable string
    "message": "Slot already booked for 06:00–07:00",  // safe to display
    "fields": {                            // present for 400 / 422 only
      "slot_id": "not available for the requested time"
    }
  }
}
```

- `*Read` schemas only — **never serialize an ORM model** directly.
- `error.message` never contains a stack trace, SQL, internal path, or another tenant's data.
- `error.code` values are documented per module in `docs/backend/api/<module>.md`.

## HTTP status mapping

| Code | When |
|------|------|
| 200 | successful read / update-with-body |
| 201 | successful create |
| 204 | successful update/delete, no body |
| 400 | malformed request — bad query param, invalid enum value |
| 401 | missing / expired / invalid session |
| 403 | authenticated but not authorized for this role / community scope |
| 404 | not found **or outside the caller's tenant scope** (never distinguished — prevents cross-tenant existence leaks) |
| 409 | conflict — overlapping amenity booking, already-allocated parking slot |
| 422 | schema-valid but business-rule-invalid (e.g. closing a ticket without resident confirmation) |
| 429 | rate limit exceeded on a sensitive endpoint (login, OTP, payment-sim) |
| 500 | unhandled server error — logged with request id, generic message returned |

## Security controls applied at the API layer (uniform)

- **CSRF**: every cookie-authenticated state-changing request must carry `X-CSRF-Token` = `gs_csrf` cookie.
- **CORS**: locked to the known Next.js origin(s) per environment; credentials allowed.
- **Rate limiting** (`slowapi`): `/auth/login`, OTP/PIN verify, payment-simulation endpoints.
- **Upload validation**: content-type (sniffed) + extension allow-list + size, server-side, before storage.
- **Scope-before-query**: role + `community_id` filters are applied in the data-access layer
  **before** execution — never filter already-fetched cross-tenant rows in app code.
- Auth/session detail: [`authentication.md`](authentication.md). RBAC: [`../security/roles-permissions.md`](../security/roles-permissions.md).

## Idempotency

Money / state-changing / retryable operations (simulated payment, invoice generation, webhook
handlers, Celery tasks) must be safe against duplicate execution — use a natural unique key
(`payment_reference`, `invoice_number`) or an explicit idempotency key.

## Representative endpoints (FR → path)

| FR | Module | Representative endpoints |
|----|--------|--------------------------|
| 01 | auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/otp/request` · `POST /auth/otp/verify` |
| 03 | communities | `/communities` · `/towers` · `/floors` · `/units` · `/units/{id}/residents` |
| 04 | visitors | `/visitors` · `/visitor-requests` · `/visitor-requests/{id}/approve` · `/visitor-passes` |
| 05 | gate | `/gate/entries` · `/gate/exits` · `/gate/panic-alert` · `/gate/live` (feed) |
| 06 | domestic_staff | `/staff` · `/staff/{id}/assignments` · `/staff/{id}/attendance` |
| 07 | deliveries | `/deliveries` · `/units/{id}/delivery-protocol` |
| 08 | vehicles | `/vehicles` · `/parking-slots` · `/parking-allocations` · `/parking-violations` |
| 09 | billing | `/maintenance-invoices` · `/maintenance-invoices/{id}/pay` · `/residents/{id}/ledger` |
| 10 | complaints | `/service-tickets` · `/service-tickets/{id}/status` · `/service-tickets/{id}/feedback` |
| 11 | amenities | `/amenities` · `/amenities/{id}/slots` · `/amenity-bookings` |
| 12 | communication | `/announcements` · `/polls` · `/polls/{id}/respond` |
| 13 | incidents | `/incidents` · `/incidents/{id}/actions` · `/incidents/{id}/resolve` |
| 14 | dashboards | `/dashboards/super-admin` · `/dashboards/community-admin` · `/dashboards/security` · `/dashboards/resident` |
| 16 | audit/search | `/search` · `/reports/*` · `/audit-logs` (auditor GET-only) |

Exact paths are finalised at API-contract sign-off (Phase 1) and documented per module.

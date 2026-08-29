# API — Delivery Management (`/api/v1/deliveries`) — FR-07

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

**Row-level scope:** a plain resident only sees / decides deliveries for the **units they
occupy** (list filtered; another unit's delivery → `404`). Guards and admins are unrestricted
(AGENTS.md §3 "Row-level access").

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /deliveries/health` | – (session) | – | `200` | liveness |
| `GET /deliveries/protocols` | `deliveries:view` | – | `200` list | `?community_id=` |
| `PUT /deliveries/protocols` | `deliveries:approve` | `ProtocolUpsert` | `200` single | upsert on `(community, delivery_type)` |
| `GET /deliveries` | `deliveries:view` | – | `200` list | `?unit_id=`, `?delivery_status=`, `?approval_status=`, `?community_id=` |
| `POST /deliveries` | `deliveries:create` | `DeliveryCreate` | `201` single | auto-creates protocol if missing; `404` if unit outside scope |
| `GET /deliveries/{delivery_id}` | `deliveries:view` | – | `200` single | `404` outside scope |
| `GET /deliveries/{delivery_id}/events` | `deliveries:view` | – | `200` list | ordered by `occurred_at` |
| `POST /deliveries/{delivery_id}/decision` | `deliveries:approve` | `DeliveryDecision` | `200` single | `422 INVALID_TRANSITION` if not pending |
| `POST /deliveries/{delivery_id}/arrival` | `deliveries:update` | `DeliveryArrival` | `200` single | `422 NOT_APPROVED` / `INVALID_TRANSITION` |
| `POST /deliveries/{delivery_id}/delivered` | `deliveries:update` | – | `200` single | `422 INVALID_TRANSITION` |
| `POST /deliveries/{delivery_id}/cancel` | `deliveries:update` | – | `200` single | `422 INVALID_TRANSITION` if terminal |

## Schemas (write — all `extra="forbid"`)

- **ProtocolUpsert**: `delivery_type`, `protocol_type="collect_at_gate"`, `requires_otp=false`, `allow_direct_entry=false`, `leave_at_gate=true`, `allowed_start_time?`, `allowed_end_time?`, `is_active=true`.
- **DeliveryCreate**: `unit_id`, `delivery_type`, `provider_name?`, `executive_name?`, `executive_phone?`, `tracking_reference?`, `expected_at?`, `parcel_count=1` (1–100), `notes?`.
- **DeliveryDecision**: `decision` (`approved|rejected`), `remarks?`.
- **DeliveryArrival**: `gate_id?`, `executive_name?`, `executive_phone?`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `INVALID_TRANSITION` · `NOT_APPROVED` · `CSRF_INVALID`.

## Audit

`protocol.create`, `protocol.update`, `delivery.create`, `delivery.approved`,
`delivery.rejected`, `delivery.arrived`, `delivery.delivered`, `delivery.cancel` — written to
`audit_logs` in the same transaction. The per-delivery timeline also lives in `delivery_events`.

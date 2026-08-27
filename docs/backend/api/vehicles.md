# API — Vehicle & Parking (`/api/v1/vehicles`) — FR-08

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /vehicles/health` | – (session) | – | `200` | liveness |
| `GET /vehicles/parking/rules` | `vehicles:view` | – | `200` single | auto-creates the rule row |
| `PATCH /vehicles/parking/rules` | `vehicles:approve` | `RuleUpdate` | `200` single | partial |
| `GET /vehicles/parking/slots` | `vehicles:view` | – | `200` list | `?slot_status=` |
| `POST /vehicles/parking/slots` | `vehicles:approve` | `SlotCreate` | `201` single | `409 SLOT_EXISTS` |
| `GET /vehicles/parking/allocations` | `vehicles:view` | – | `200` list | `?active_only=true` |
| `POST /vehicles/parking/allocations` | `vehicles:approve` | `AllocationCreate` | `201` single | `409 SLOT_TAKEN` / `VEHICLE_HAS_SLOT`; `422 UNIT_SLOT_LIMIT` |
| `POST /vehicles/parking/allocations/{allocation_id}/release` | `vehicles:update` | – | `200` single | `422 ALREADY_RELEASED` |
| `GET /vehicles/parking/violations` | `vehicles:view` | – | `200` list | `?violation_status=` |
| `POST /vehicles/parking/violations` | `vehicles:create` | `ViolationCreate` | `201` single | |
| `POST /vehicles/parking/violations/{violation_id}/status?new_status=` | `vehicles:update` | – | `200` single | `422 INVALID_TRANSITION` |
| `GET /vehicles/entries` | `vehicles:view` | – | `200` list | `?plate=`, `?open_only=true` |
| `POST /vehicles/entries` | `vehicles:create` | `EntryCreate` | `201` single | unknown plate → `is_flagged`; `409 ALREADY_INSIDE` |
| `PATCH /vehicles/entries/{entry_id}/exit` | `vehicles:update` | – | `200` single | `422 NOT_INSIDE` |
| `GET /vehicles` | `vehicles:view` | – | `200` list | `?q=` (plate) |
| `POST /vehicles` | `vehicles:create` | `VehicleCreate` | `201` single | owner XOR; `409 VEHICLE_EXISTS`; `422 INVALID_ENUM` |
| `GET /vehicles/{vehicle_id}` | `vehicles:view` | – | `200` single | `404` outside scope |
| `PATCH /vehicles/{vehicle_id}` | `vehicles:update` | `VehicleUpdate` | `200` single | partial |

## Schemas (write — all `extra="forbid"`)

- **VehicleCreate**: `vehicle_type`, `registration_number` (3–20), exactly one of `resident_profile_id` / `visitor_id`, `unit_id?`, `make?`, `model?`, `color?`, `sticker_number?`.
- **VehicleUpdate**: `vehicle_type?`, `make?`, `model?`, `color?`, `sticker_number?`, `unit_id?`, `is_active?`.
- **RuleUpdate**: `allow_multi_slot_vehicle?`, `allow_guest_parking?`, `max_active_slots_per_unit?` (0–20), `violation_grace_minutes?` (0–1440).
- **SlotCreate**: `slot_code`, `slot_type="car"`, `tower_id?`, `level?`, `is_guest_slot=false`, `reserved_for_unit_id?`.
- **AllocationCreate**: `slot_id`, `vehicle_id`, `unit_id?`, `allocated_to?`.
- **EntryCreate**: `registration_number`, `gate_id?`, `source_type="unknown"`, `reference_id?`.
- **ViolationCreate**: `violation_type`, `vehicle_id?`, `parking_slot_id?`, `description?`, `evidence_url?`, `fine_amount?` (≥ 0).

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `VEHICLE_EXISTS` · `SLOT_EXISTS` · `SLOT_TAKEN` · `VEHICLE_HAS_SLOT` ·
`UNIT_SLOT_LIMIT` · `ALREADY_RELEASED` · `ALREADY_INSIDE` · `NOT_INSIDE` · `INVALID_TRANSITION` ·
`CSRF_INVALID`.

## Audit

`rule.update`, `vehicle.register`, `vehicle.update`, `slot.create`, `allocation.create`,
`allocation.release`, `entry.create`, `entry.exit`, `violation.report`,
`violation.{acknowledged,resolved,waived}` — written to `audit_logs` in the same transaction.

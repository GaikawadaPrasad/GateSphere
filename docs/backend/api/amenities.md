# API — Amenity Booking (`/api/v1/amenities`) — FR-11

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /amenities/health` | – (session) | – | `200` | liveness |
| `GET /amenities/bookings` | `amenities:view` | – | `200` list | `?amenity_id=`, `?booking_status=`, `?mine=true`, `?community_id=` |
| `POST /amenities/bookings` | `amenities:create` | `BookingCreate` | `201` single | atomic conflict check; `422 SLOT_WEEKDAY_MISMATCH` / `NO_UNIT` / `TOO_FAR_AHEAD` / `TOO_LONG` / `UNIT_BOOKING_LIMIT`; `409 AMENITY_BLOCKED` / `SLOT_FULL` |
| `GET /amenities/bookings/{booking_id}` | `amenities:view` | – | `200` single | |
| `POST /amenities/bookings/{booking_id}/cancel` | `amenities:view` | `BookingCancel` | `200` single | owner or `amenities:update`; `403 NOT_BOOKING_OWNER`; `422 TOO_LATE_TO_CANCEL` |
| `POST /amenities/bookings/{booking_id}/status?new_status=` | `amenities:update` | – | `200` single | `completed` / `no_show` only |
| `GET /amenities` | `amenities:view` | – | `200` list | `?community_id=` |
| `POST /amenities` | `amenities:approve` | `AmenityCreate` | `201` single | `409 AMENITY_EXISTS` |
| `PATCH /amenities/{amenity_id}` | `amenities:approve` | `AmenityUpdate` | `200` single | partial |
| `GET /amenities/{amenity_id}/slots` | `amenities:view` | – | `200` list | |
| `POST /amenities/{amenity_id}/slots` | `amenities:approve` | `SlotCreate` | `201` single | `422 INVALID_TIME_RANGE` |
| `DELETE /amenities/slots/{slot_id}` | `amenities:approve` | – | `204` | soft-disable (`is_active=false`) |
| `GET /amenities/{amenity_id}/rules` | `amenities:view` | – | `200` list | |
| `PUT /amenities/{amenity_id}/rules` | `amenities:approve` | `RuleUpsert` | `200` single | upsert on `(amenity, rule_type)` |
| `GET /amenities/{amenity_id}/blocks` | `amenities:view` | – | `200` list | |
| `POST /amenities/{amenity_id}/blocks` | `amenities:update` | `BlockCreate` | `201` single | `422 INVALID_TIME_RANGE` |

## Schemas (write — all `extra="forbid"`)

- **AmenityCreate**: `code`, `name`, `amenity_type="other"`, `location_text?`, `capacity=1`, `booking_required=true`.
- **SlotCreate**: `day_of_week` (0–6), `start_time`, `end_time`, `capacity?`, `fee=0`.
- **RuleUpsert**: `rule_type` (`max_advance_days|max_active_per_unit|min_cancel_hours|max_hours_per_booking`), `rule_value` (object, e.g. `{"value": 14}`).
- **BlockCreate**: `blocked_from`, `blocked_to`, `reason?`.
- **BookingCreate**: `amenity_id`, `slot_id`, `booking_date`, `participant_count=1`.
- **BookingCancel**: `reason?`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `AMENITY_EXISTS` · `INVALID_TIME_RANGE` · `AMENITY_INACTIVE` ·
`SLOT_INACTIVE` · `SLOT_WEEKDAY_MISMATCH` · `DATE_IN_PAST` · `NO_UNIT` · `TOO_FAR_AHEAD` ·
`TOO_LONG` · `UNIT_BOOKING_LIMIT` · `AMENITY_BLOCKED` · `SLOT_FULL` · `INVALID_TRANSITION` ·
`NOT_BOOKING_OWNER` · `TOO_LATE_TO_CANCEL` · `CSRF_INVALID`.

## Audit

`amenity.create`, `amenity.update`, `slot.create`, `slot.disable`, `rule.create`,
`rule.update`, `block.create`, `booking.create`, `booking.cancel`, `booking.completed`,
`booking.no_show` — written to `audit_logs` in the same transaction.

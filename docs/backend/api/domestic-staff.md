# API — Domestic Staff (`/api/v1/domestic-staff`) — FR-06

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /domestic-staff/health` | – (session) | – | `200` | liveness |
| `GET /domestic-staff` | `domestic_staff:view` | – | `200` list | `?q=` (name/phone), `?community_id=` |
| `POST /domestic-staff` | `domestic_staff:create` | `StaffCreate` | `201` single | `409 STAFF_EXISTS`; `422 INVALID_ENUM` / `COMMUNITY_REQUIRED` |
| `GET /domestic-staff/{staff_id}` | `domestic_staff:view` | – | `200` single | `404` outside scope |
| `PATCH /domestic-staff/{staff_id}` | `domestic_staff:update` | `StaffUpdate` | `200` single | partial |
| `GET /domestic-staff/assignments` | `domestic_staff:view` | – | `200` list | `?staff_id=`, `?unit_id=`, `?active_only=true` |
| `POST /domestic-staff/assignments` | `domestic_staff:approve` | `AssignmentCreate` | `201` single | `409 ASSIGNMENT_EXISTS`; `422 INVALID_DATE_RANGE`; `404` staff/unit outside scope |
| `POST /domestic-staff/assignments/{assignment_id}/end` | `domestic_staff:update` | – | `200` single | `422 ALREADY_ENDED` |
| `GET /domestic-staff/attendance` | `domestic_staff:view` | – | `200` list | `?staff_id=`, `?open_only=true`, `?community_id=` |
| `POST /domestic-staff/attendance/check-in` | `domestic_staff:create` | `CheckInCreate` | `201` single | `409 ALREADY_INSIDE` |
| `PATCH /domestic-staff/attendance/{attendance_id}/check-out` | `domestic_staff:update` | – | `200` single | `422 NOT_INSIDE` |
| `POST /domestic-staff/ratings` | `domestic_staff:view` | `RatingCreate` | `201` single | upsert per `(staff, unit, caller)` |
| `GET /domestic-staff/{staff_id}/ratings` | `domestic_staff:view` | – | `200` list | |

## Schemas (write — all `extra="forbid"`)

- **StaffCreate**: `full_name`, `staff_type`, `phone` (`^[+0-9][0-9 \-]{4,19}$`), `user_id?`, `id_type?`, `id_number?`, `photo_url?`, `police_verification_status="not_started"`, `verification_expiry?`, `emergency_address?`.
- **StaffUpdate**: `full_name?`, `staff_type?`, `photo_url?`, `police_verification_status?`, `verification_expiry?`, `emergency_address?`, `is_active?`.
- **AssignmentCreate**: `staff_id`, `unit_id`, `work_type="part_time"`, `start_date?`, `end_date?`, `time_from?`, `time_to?`.
- **CheckInCreate**: `staff_id`, `gate_id?`.
- **RatingCreate**: `staff_id`, `unit_id?`, `rating` (1–5), `feedback?`.

Read models expose no hashes.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `STAFF_EXISTS` · `INVALID_DATE_RANGE` · `ASSIGNMENT_EXISTS` ·
`ALREADY_ENDED` · `ALREADY_INSIDE` · `NOT_INSIDE` · `CSRF_INVALID`.

## Audit

`staff.create`, `staff.update`, `assignment.create`, `assignment.end`, `attendance.check_in`,
`attendance.check_out`, `rating.create`, `rating.update` — written to `audit_logs` in the same
transaction.

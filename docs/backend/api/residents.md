# API — Residents (`/api/v1/residents`) — FR-03

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`).

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /residents` | `residents:view` | – | `200` list | `?community_id=` (required for a global caller), `?page`, `?page_size` |
| `POST /residents` | `residents:create` | `ResidentProfileCreate` | `201` single | `?community_id=` for global caller; `409 PROFILE_EXISTS`; `422 INVALID_ENUM` / `COMMUNITY_REQUIRED` |
| `GET /residents/{profile_id}` | `residents:view` | – | `200` single | `404` if outside scope |
| `PATCH /residents/{profile_id}` | `residents:update` | `ResidentProfileUpdate` | `200` single | partial |
| `GET /residents/{profile_id}/emergency-contacts` | `residents:view` | – | `200` list | ordered by `priority` |
| `POST /residents/{profile_id}/emergency-contacts` | `residents:create` | `EmergencyContactCreate` | `201` single | |
| `DELETE /residents/emergency-contacts/{contact_id}` | `residents:delete` | – | `204` | |
| `GET /residents/units/{unit_id}/occupancies` | `residents:view` | – | `200` list | active first |
| `POST /residents/occupancies` | `residents:create` | `OccupancyCreate` | `201` single | `409 OCCUPANCY_EXISTS` / `PRIMARY_OCCUPANT_EXISTS`; `404` if unit/profile outside scope |
| `PATCH /residents/occupancies/{occupancy_id}/end` | `residents:update` | `OccupancyEnd` (`end_date`, `is_active=false`) | `200` single | `422 INVALID_DATE_RANGE` |
| `GET /residents/units/{unit_id}/family-members` | `residents:view` | – | `200` list | |
| `POST /residents/family-members` | `residents:create` | `FamilyMemberCreate` | `201` single | `relationship` is an alias for `relationship_type` |
| `GET /residents/move-records` | `residents:view` | – | `200` list | `?community_id=`, `?move_status=` |
| `POST /residents/move-records` | `residents:create` | `MoveRecordCreate` | `201` single | status starts `scheduled` if `scheduled_at` given, else `requested` |
| `GET /residents/move-records/{move_id}` | `residents:view` | – | `200` single | |
| `PATCH /residents/move-records/{move_id}/status` | `residents:update` | `MoveRecordTransition` (`status`, `scheduled_at?`, `clearance_notes?`) | `200` single | `422 INVALID_TRANSITION`; `approved` stamps approver; `completed` move_out deactivates the occupancy |

## Schemas (write — all `extra="forbid"`)

- **ResidentProfileCreate**: `user_id`, `profile_status="pending"`, `kyc_status="not_started"`, `move_in_date?`, `emergency_notes?`.
- **OccupancyCreate**: `unit_id`, `resident_profile_id`, `occupancy_role`, `is_primary=false`, `start_date?`, `agreement_reference?`.
- **OccupancyEnd**: `end_date`, `is_active=false`.
- **FamilyMemberCreate**: `unit_id`, `primary_resident_profile_id`, `full_name`, `relationship` (alias), `user_id?`, `date_of_birth?`, `phone?`.
- **EmergencyContactCreate**: `name`, `relationship` (alias), `phone`, `alternate_phone?`, `priority=1` (1–10).
- **MoveRecordCreate**: `unit_id`, `resident_profile_id`, `move_type`, `scheduled_at?`, `clearance_notes?`.
- **MoveRecordTransition**: `status`, `scheduled_at?`, `clearance_notes?`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `PROFILE_EXISTS` · `OCCUPANCY_EXISTS` · `PRIMARY_OCCUPANT_EXISTS` ·
`INVALID_DATE_RANGE` · `INVALID_TRANSITION` · `CSRF_INVALID`.

## Audit

`profile.{create,update}`, `occupancy.{create,end}`, `family.create`, `contact.{create,delete}`,
`move.{create,transition}` — written to `audit_logs` in the same transaction.

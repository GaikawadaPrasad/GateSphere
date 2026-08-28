# API — Gate / Security Operations (`/api/v1/gate`) — FR-05

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /gate/health` | – (session) | – | `200` | liveness |
| `GET /gate/events` | `gate:view` | – | `200` list | `?gate_id=`, `?event_type=`, `?community_id=` |
| `POST /gate/events` | `gate:create` | `EventCreate` | `201` single | append-only; `422 INVALID_ENUM`; `404` if gate outside scope |
| `GET /gate/rosters` | `gate:view` | – | `200` list | `?guard_user_id=`, `?roster_status=` |
| `POST /gate/rosters` | `gate:create` | `RosterCreate` | `201` single | `422 INVALID_TIME_RANGE`; `409 ROSTER_EXISTS` |
| `PATCH /gate/rosters/{roster_id}` | `gate:update` | `RosterUpdate` | `200` single | details only (supervisor / notes) |
| `POST /gate/rosters/{roster_id}/status` | `gate:update` | `RosterTransition` | `200` single | `planned→active→completed` / `→cancelled`; `422 INVALID_TRANSITION` |
| `GET /gate/assignments` | `gate:view` | – | `200` list | `?gate_id=`, `?active_only=true` |
| `POST /gate/assignments` | `gate:create` | `AssignmentCreate` | `201` single | `409 ASSIGNMENT_ACTIVE`; `404` gate/roster outside scope |
| `POST /gate/assignments/{assignment_id}/end` | `gate:update` | – | `200` single | `422 ALREADY_ENDED` |
| `GET /gate/alerts` | `gate:view` | – | `200` list | `?alert_status=` |
| `POST /gate/alerts` | *session only* | `AlertCreate` | `201` single | any role may raise; `community_id` required for a global caller |
| `POST /gate/alerts/{alert_id}/acknowledge` | `gate:update` | – | `200` single | `422 INVALID_TRANSITION` if not `active` |
| `POST /gate/alerts/{alert_id}/resolve` | `gate:update` | `AlertResolve` | `200` single | from `active` / `acknowledged` |
| `POST /gate/alerts/{alert_id}/cancel` | *raiser only* | – | `200` single | `403 NOT_ALERT_OWNER`; `422 INVALID_TRANSITION` |

## Schemas (write — all `extra="forbid"`)

- **EventCreate**: `gate_id?`, `event_type`, `reference_type?`, `reference_id?`, `occurred_at?`, `metadata?` (object).
- **RosterCreate**: `guard_user_id`, `supervisor_user_id?`, `shift_date`, `shift_start`, `shift_end`, `notes?`.
- **RosterUpdate**: `supervisor_user_id?`, `notes?`.
- **RosterTransition**: `status`, `reason?`.
- **AssignmentCreate**: `guard_user_id`, `gate_id`, `roster_id?`, `assigned_from?`, `assigned_to?`.
- **AlertCreate**: `alert_type="other"`, `severity="high"`, `gate_id?`, `message?`, `community_id?` (global caller only).
- **AlertResolve**: `resolution_summary?`.

`EventRead.metadata` reads the ORM `event_metadata` column.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `INVALID_TIME_RANGE` · `ROSTER_EXISTS` · `INVALID_TRANSITION` ·
`ASSIGNMENT_ACTIVE` · `ALREADY_ENDED` · `NOT_ALERT_OWNER` · `CSRF_INVALID`.

## Audit

`event.log`, `roster.create`, `roster.update`, `assignment.create`, `assignment.end`,
`alert.raise`, `alert.acknowledge`, `alert.resolve`, `alert.cancel` — written to `audit_logs`
in the same transaction.

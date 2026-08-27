# API — Emergency & Incident Management (`/api/v1/incidents`) — FR-13

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `IncidentCreate` carries
`community_id` in the body for a global caller.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /incidents/health` | – (session) | – | `200` | liveness |
| `GET /incidents` | `incidents:view` | – | `200` list | `?incident_status=`, `?severity=`, `?community_id=` |
| `POST /incidents` | `incidents:create` | `IncidentCreate` | `201` single | `404` if tower/unit/gate/panic_alert outside scope |
| `GET /incidents/{incident_id}` | `incidents:view` | – | `200` single | |
| `PATCH /incidents/{incident_id}` | `incidents:update` | `IncidentUpdate` | `200` single | refused once closed / false_alarm |
| `POST /incidents/{incident_id}/transition` | `incidents:update` | `IncidentTransition` | `200` single | `422 INVALID_TRANSITION` / `SUMMARY_REQUIRED` |
| `GET /incidents/{incident_id}/history` | `incidents:view` | – | `200` list | append-only, chronological |
| `GET /incidents/{incident_id}/assignments` | `incidents:view` | – | `200` list | |
| `POST /incidents/{incident_id}/assignments` | `incidents:update` | `AssignIn` | `201` single | `409 ALREADY_ASSIGNED` |
| `POST /incidents/assignments/{assignment_id}/release` | `incidents:update` | – | `200` single | `422 ALREADY_RELEASED` |
| `GET /incidents/{incident_id}/actions` | `incidents:view` | – | `200` list | append-only operational log |
| `POST /incidents/{incident_id}/actions` | `incidents:update` | `ActionIn` | `201` single | |

## Schemas (write — all `extra="forbid"`)

- **IncidentCreate**: `incident_type`, `severity="medium"`, `tower_id?`, `unit_id?`, `gate_id?`, `panic_alert_id?`, `location_text?`, `description?`, `community_id?` (global caller).
- **IncidentUpdate**: `severity?`, `location_text?`, `description?`.
- **IncidentTransition**: `status`, `reason?`, `resolution_summary?` (required to reach `resolved`).
- **AssignIn**: `assigned_user_id`.
- **ActionIn**: `action_type` (`note|dispatch|escalation|authority_contacted|evacuation|medical_aid|update`), `details?`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `INVALID_TRANSITION` · `SUMMARY_REQUIRED` · `ALREADY_ASSIGNED` ·
`ALREADY_RELEASED` · `CSRF_INVALID`.

## Audit

`incident.create`, `incident.update`, `incident.<status>`, `incident.assign`,
`incident.release`, `incident.action` — written to `audit_logs` in the same transaction. The
per-incident timeline also lives in `incident_status_history` + `incident_actions`.

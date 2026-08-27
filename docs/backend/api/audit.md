# API — Audit Logging query (`/api/v1/audit`) — FR-16

Canonical envelope. **Read-only** — `audit_logs` is immutable (`REVOKE UPDATE/DELETE` in
staging). A global caller (Super Admin / Auditor) sees every community's rows plus
platform-level rows (`community_id IS NULL`); a community-scoped caller sees only their own
community's rows.

## Endpoints

| Method & path | Permission | Success | Notes |
|---|---|---|---|
| `GET /audit/health` | – (session) | `200` | liveness |
| `GET /audit/logs` | `audit:view` | `200` list | filters: `?community_id=`, `?module=`, `?action=`, `?entity_type=`, `?entity_id=`, `?user_id=`, `?since=`, `?until=`; `?page`, `?page_size` |
| `GET /audit/logs.csv` | `audit:export` | `200` `text/csv` | same filters; capped at 10 000 rows; `Content-Disposition: attachment` |
| `GET /audit/logs/{log_id}` | `audit:view` | `200` single | `404` outside scope |

`audit:view` / `audit:export` are held by **Auditor** and **Super Admin** (and `audit:view`
by Association Committee); Community Admin explicitly does **not** have `audit:*`.

## Response shape (`AuditLogRead`)

`id`, `created_at`, `community_id`, `user_id`, `session_id`, `module`, `action`,
`entity_type`, `entity_id`, `old_values` (JSON), `new_values` (JSON), `ip_address`,
`user_agent`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND`.

## Audit

None — reading the audit log is not itself audited.

# API — Communication & Broadcasts (`/api/v1/communication`) — FR-12

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /communication/health` | – (session) | – | `200` | liveness |
| `GET /communication/announcements` | `communication:view` | – | `200` list | `?published_only=` (default true), `?community_id=` |
| `POST /communication/announcements` | `communication:create` | `AnnouncementCreate` | `201` single | draft; targets validated against the community |
| `GET /communication/announcements/{announcement_id}` | `communication:view` | – | `200` single | includes `targets` |
| `PATCH /communication/announcements/{announcement_id}` | `communication:update` | `AnnouncementUpdate` | `200` single | `422 ALREADY_PUBLISHED` |
| `POST /communication/announcements/{announcement_id}/publish` | `communication:approve` | – | `200` single | `422 NO_TARGET` / `ALREADY_PUBLISHED` |
| `POST /communication/announcements/{announcement_id}/expire` | `communication:update` | – | `200` single | sets `expires_at = now` |
| `POST /communication/polls` | `communication:create` | `PollCreate` | `201` single | `422 NOT_A_POLL`; `409 POLL_EXISTS` |
| `GET /communication/polls/{poll_id}` | `communication:view` | – | `200` single | includes `options` |
| `POST /communication/polls/{poll_id}/status?new_status=` | `communication:approve` | – | `200` single | `open` / `closed`; `422 ANNOUNCEMENT_DRAFT` / `INVALID_TRANSITION` |
| `POST /communication/polls/{poll_id}/vote` | `communication:view` | `VoteIn` | `201` results | `422 POLL_NOT_OPEN` / `POLL_CLOSED` / `INVALID_OPTION` / `SINGLE_CHOICE_ONLY`; `409 ALREADY_VOTED` |
| `GET /communication/polls/{poll_id}/results` | `communication:view` | – | `200` results | per-option vote counts |

## Schemas (write — all `extra="forbid"`)

- **AnnouncementCreate**: `announcement_type="notice"`, `title`, `body`, `priority="normal"`, `publish_at?`, `expires_at?`, `event_start_at?`, `event_end_at?`, `targets: [TargetIn]`.
- **TargetIn**: one of `tower_id` / `unit_id` / `role_id` / `target_all_community=true`.
- **AnnouncementUpdate**: any of the above (draft only); `targets` replaces the set.
- **PollCreate**: `announcement_id`, `question`, `allow_multiple=false`, `opens_at?`, `closes_at?`, `options: [{option_text, display_order?}]` (≥ 2).
- **VoteIn**: `option_ids: [uuid, …]` (≥ 1).

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `ALREADY_PUBLISHED` · `NO_TARGET` · `NOT_A_POLL` · `POLL_EXISTS` ·
`INVALID_TRANSITION` · `ANNOUNCEMENT_DRAFT` · `POLL_NOT_OPEN` · `POLL_CLOSED` · `INVALID_OPTION` ·
`SINGLE_CHOICE_ONLY` · `ALREADY_VOTED` · `CSRF_INVALID`.

## Audit

`announcement.create`, `announcement.update`, `announcement.publish`, `announcement.expire`,
`poll.create`, `poll.open`, `poll.closed`, `poll.vote` — written to `audit_logs` in the same
transaction.

# API — Visitor Management (`/api/v1/visitors`) — FR-04

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

**Row-level scope:** a plain resident (no management/security role) only sees and acts on visitor
requests / entries for the **units they occupy** — `GET /requests` and `/entries` are filtered to
their units, and a request/decision/pass for another unit returns `404` (AGENTS.md §3
"Row-level access"). Guards, supervisors and admins are unrestricted.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /visitors/health` | – (session) | – | `200` | `{module, status}` liveness |
| `GET /visitors/policy` | `visitors:view` | – | `200` single | auto-creates the policy row on first read |
| `PATCH /visitors/policy` | `visitors:update` | `PolicyUpdate` | `200` single | partial |
| `GET /visitors/blacklist` | `visitors:view` | – | `200` list | `?community_id=`, `?page`, `?page_size` |
| `POST /visitors/blacklist` | `visitors:update` | `BlacklistCreate` | `201` single | `422 INVALID_ENUM` (risk_level) |
| `GET /visitors/entries` | `visitors:view` | – | `200` list | `?entry_status=inside\|exited\|denied` |
| `POST /visitors/entries` | `visitors:create` | `EntryCreate` | `201` single | one of `pass_token` / `pin` / `request_id`; `pin` scans non-revoked passes (send `request_id` too if `409 PIN_AMBIGUOUS`); optional `visitor_id` admits a specific group member (`422 NOT_IN_GROUP` otherwise); `404 PASS/REQUEST`; `422 PASS_REVOKED\|PASS_EXPIRED\|PASS_EXHAUSTED\|NOT_APPROVED`; `403 VISITOR_BLACKLISTED` (records a `denied` entry); `409 ALREADY_INSIDE` |
| `PATCH /visitors/entries/{entry_id}/exit` | `visitors:update` | – | `200` single | `422 NOT_INSIDE`; completes a still-`entered` request |
| `GET /visitors/requests` | `visitors:view` | – | `200` list | `?request_status=`, `?unit_id=`, `?community_id=` |
| `POST /visitors/requests` | `visitors:create` | `RequestCreate` | `201` single | `visitor` or `visitor_id` (`422 VISITOR_REQUIRED`); `403 VISITOR_BLACKLISTED`; `422 INVALID_ENUM`; `404` if unit outside scope |
| `GET /visitors/requests/{request_id}` | `visitors:view` | – | `200` single | `404` outside scope |
| `POST /visitors/requests/{request_id}/decision` | `visitors:approve` | `RequestDecision` | `200` single | `422 INVALID_TRANSITION` (not pending); `409 ALREADY_DECIDED` |
| `POST /visitors/requests/{request_id}/cancel` | `visitors:update` | – | `200` single | `422 INVALID_TRANSITION` (not pending/approved) |
| `POST /visitors/requests/{request_id}/passes` | `visitors:create` | `PassCreate` | `201` single | `422 INVALID_STATE` / `INVALID_DATE_RANGE`; pre-approves a pending request; `token` (+ `pin` when `with_pin` / `pin` / `otp`) returned once |
| `POST /visitors/passes/{pass_id}/revoke` | `visitors:update` | – | `204` | |
| `GET /visitors/requests/{request_id}/members` | `visitors:view` | – | `200` list | the visitor party covered by one approval (primary first) |
| `POST /visitors/requests/{request_id}/members` | `visitors:create` | `GroupMemberCreate` | `201` single | add a distinct visitor to the group; `409 MEMBER_EXISTS`; `403 VISITOR_BLACKLISTED`; blocked on terminal request status |
| `GET /visitors` | `visitors:view` | – | `200` list | `?q=` (name/phone ilike), `?community_id=` |

## Schemas (write — all `extra="forbid"`)

- **PolicyUpdate**: `approval_required?`, `photo_required?`, `otp_required?`, `pass_ttl_minutes?` (5–10080), `blacklist_mode?` (`block\|warn`).
- **BlacklistCreate**: `phone`, `id_number?`, `visitor_id?`, `reason`, `risk_level="medium"`, `active_until?`.
- **RequestCreate**: `unit_id`, `visitor: VisitorCreate?`, `visitor_id?`, `visitor_type`, `purpose?`, `expected_at?`, `valid_until?`, `vehicle_number?`, `group_label?`, `party_size=1` (1–50), `additional_visitor_ids?` (extra visitors covered by this approval).
- **GroupMemberCreate**: `visitor_id?` **xor** `visitor: VisitorCreate?`.
- **VisitorCreate**: `full_name`, `phone` (`^[+0-9][0-9 \-]{4,19}$`), `id_type?`, `id_number?`, `vehicle_number?`, `photo_url?`.
- **RequestDecision**: `decision` (`approved\|rejected`), `remarks?`.
- **PassCreate**: `pass_type="qr"` (`qr\|pin\|otp`), `valid_from?`, `valid_to?`, `max_entries=1` (1–50), `with_pin=false` (issue a 6-digit gate PIN — implied for `pin`/`otp`). PIN stored as a SHA-256 `pin_hash`, verified at the gate.
- **EntryCreate**: `request_id?`, `pass_token?`, `pin?` (4–12), `visitor_id?`, `gate_id?`, `vehicle_number?`, `entry_photo_url?`.

Read models expose no hashes: `VisitorRead`, `BlacklistRead`, `RequestRead`, `PassRead`
(`token` only on the create response), `EntryRead`, `PolicyRead`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `VISITOR_REQUIRED` · `VISITOR_BLACKLISTED` · `INVALID_TRANSITION` ·
`ALREADY_DECIDED` · `INVALID_STATE` · `INVALID_DATE_RANGE` · `PASS_REVOKED` · `PASS_EXPIRED` ·
`PASS_EXHAUSTED` · `NOT_APPROVED` · `REQUEST_REQUIRED` · `ALREADY_INSIDE` · `NOT_INSIDE` ·
`CSRF_INVALID`.

## Audit

`policy.update`, `blacklist.add`, `request.create`, `request.blacklisted`,
`request.approved` / `request.rejected`, `request.cancel`, `request.add_member`,
`request.expired` (Celery sweep), `pass.create`, `pass.revoke`, `entry.create`,
`entry.denied`, `entry.exit` — written to `audit_logs` in the same transaction.

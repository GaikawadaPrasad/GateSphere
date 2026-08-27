# API — Complaint & Service Desk (`/api/v1/complaints`) — FR-10

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /complaints/health` | – (session) | – | `200` | liveness |
| `GET /complaints/categories` | `complaints:view` | – | `200` list | `?community_id=` |
| `POST /complaints/categories` | `complaints:approve` | `CategoryCreate` | `201` single | `409 CATEGORY_EXISTS` |
| `PATCH /complaints/categories/{category_id}` | `complaints:approve` | `CategoryUpdate` | `200` single | partial |
| `GET /complaints/sla` | `complaints:view` | – | `200` list | |
| `PUT /complaints/sla` | `complaints:approve` | `SlaCreate` | `200` single | upsert on `(category, priority)` |
| `GET /complaints/tickets` | `complaints:view` | – | `200` list | `?unit_id=`, `?ticket_status=`, `?community_id=` |
| `POST /complaints/tickets` | `complaints:create` | `TicketCreate` | `201` single | priority defaults to the category's; `404` if unit/category outside scope |
| `GET /complaints/tickets/{ticket_id}` | `complaints:view` | – | `200` single | |
| `GET /complaints/tickets/{ticket_id}/history` | `complaints:view` | – | `200` list | append-only, chronological |
| `GET /complaints/tickets/{ticket_id}/messages` | `complaints:view` | – | `200` list | |
| `POST /complaints/tickets/{ticket_id}/messages` | `complaints:view` | `MessageCreate` | `201` single | `is_internal` hides from resident |
| `POST /complaints/tickets/{ticket_id}/assign` | `complaints:update` | `TicketAssign` | `200` single | executor XOR; deactivates prior assignment |
| `POST /complaints/tickets/{ticket_id}/transition` | `complaints:update` | `TicketTransition` | `200` single | `422 INVALID_TRANSITION`; cannot reach `closed` / `reopened` here |
| `POST /complaints/tickets/{ticket_id}/confirm` | `complaints:view` | `TicketConfirm` | `200` single | `confirmed → closed`, `disputed → reopened`; `422` if not awaiting confirmation |
| `POST /complaints/tickets/{ticket_id}/feedback` | `complaints:view` | `FeedbackCreate` | `201` single | `422 TICKET_NOT_CLOSED`; `409 FEEDBACK_EXISTS` |

## Schemas (write — all `extra="forbid"`)

- **CategoryCreate**: `code`, `name`, `default_priority="medium"`.
- **SlaCreate**: `category_id`, `priority`, `response_minutes=120`, `resolution_minutes=1440`, `escalation_minutes=2880`.
- **TicketCreate**: `unit_id`, `category_id`, `subject`, `description?`, `priority?` (defaults to category).
- **TicketAssign**: exactly one of `assigned_to_user_id` / `vendor_name`, `remarks?`.
- **TicketTransition**: `status` (`assigned|acknowledged|in_progress|resolved|cancelled`), `remarks?`.
- **TicketConfirm**: `confirmation_status` (`confirmed|disputed`), `remarks?`.
- **MessageCreate**: `message`, `is_internal=false`.
- **FeedbackCreate**: `rating` (1–5), `comments?`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `CATEGORY_EXISTS` · `INVALID_TRANSITION` · `TICKET_NOT_CLOSED` ·
`FEEDBACK_EXISTS` · `CSRF_INVALID`.

## Audit

`category.create`, `category.update`, `sla.create`, `sla.update`, `ticket.create`,
`ticket.assign`, `ticket.<status>`, `ticket.confirm`, `ticket.message`, `ticket.feedback` —
written to `audit_logs` in the same transaction. The per-ticket timeline also lives in
`ticket_status_history`.

# API — Notifications (`/api/v1/notifications`) — FR-15

Canonical envelope. All endpoints require a session. The inbox and preferences are always the
caller's own. `notifications:create` gates templates + dispatch.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /notifications/health` | – (session) | – | `200` | liveness |
| `GET /notifications` | `notifications:view` | – | `200` list | `?unread_only=`, `?page`, `?page_size` — caller's inbox |
| `POST /notifications/read-all` | `notifications:view` | – | `200` `{marked}` | mark every unread read |
| `GET /notifications/{notification_id}` | `notifications:view` | – | `200` single | `404` if not the caller's |
| `POST /notifications/{notification_id}/read` | `notifications:view` | – | `200` single | idempotent |
| `GET /notifications/me/preferences` | `notifications:view` | – | `200` list | caller's channel prefs |
| `PUT /notifications/me/preferences` | `notifications:view` | `PreferenceUpsert` | `200` single | upsert on `(caller, community_id, channel)` |
| `GET /notifications/templates` | `notifications:create` | – | `200` list | `?community_id=` |
| `PUT /notifications/templates` | `notifications:create` | `TemplateUpsert` | `200` single | upsert on `(community, code, channel)` |
| `POST /notifications/dispatch` | `notifications:create` | `DispatchIn` | `201` single | fans out deliveries; `404` recipient/template; `422 CONTENT_REQUIRED` |

## Schemas (write — all `extra="forbid"`)

- **TemplateUpsert**: `code`, `channel="in_app"`, `title_template`, `body_template`, `is_active=true`.
- **PreferenceUpsert**: `channel`, `is_enabled=true`, `quiet_hours_start?`, `quiet_hours_end?`, `community_id?` (null = account-wide).
- **DispatchIn**: `recipient_user_id`, `notification_type`, `template_code?`, `title?`, `message?`, `reference_type?`, `reference_id?`, `context: {k: v}`, `channels: [str]?` (default `["in_app"]`), `community_id?` (global caller).

`NotificationRead` embeds `deliveries: [DeliveryRead]`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `CONTENT_REQUIRED` · `CSRF_INVALID`.

## Audit

`template.create`, `template.update`, `notification.dispatch` — written to `audit_logs` in the
same transaction. Per-notification delivery outcomes live in `notification_deliveries`.

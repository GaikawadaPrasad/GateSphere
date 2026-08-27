# Module: Notifications (FR-15)

> Canonical spec for the `notifications` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Per-community message **templates**, per-user delivered **notifications** with an append-only
**delivery log**, and per-user channel **preferences** (incl. quiet hours). Other modules call
`NotificationService.dispatch()` to fan a domain event out to a recipient. **No real gateway**
— `email` / `sms` / `whatsapp` / `push` deliveries are simulated; `in_app` is the real inbox.

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| Read own inbox · mark read · manage own preferences | `notifications:view` | **every role** (all 10) |
| Manage templates · dispatch | `notifications:create` | Community Admin, Super Admin |

## Data model

Owned tables (`docs/database/schema.md §14`), migration `0017`. `notification_templates` and
`notifications` are tenant-scoped + RLS; deliveries hang off a notification; preferences are
per user (nullable `community_id` = account-wide default).

| Table | Notes |
|-------|-------|
| `notification_templates` | UQ `(community_id, code, channel)`, UQ `(id, community_id)`. `channel` ∈ in_app·email·sms·whatsapp·push. `{placeholder}` tokens in `title_template` / `body_template`. |
| `notifications` | The recipient's inbox row. `is_read` / `read_at`. Optional `reference_type` / `reference_id` back to the originating entity. |
| `notification_deliveries` | **Append-only**. One row per channel per notification. `status` ∈ queued·sent·delivered·failed·skipped; `provider` = `in_app` or `simulated`. |
| `user_notification_preferences` | UQ `(user_id, community_id, channel)`. `is_enabled` + optional `quiet_hours_start`/`end` (wraps midnight). A community-specific row overrides the account-wide (`community_id NULL`) one. |

## Business rules (service layer)

- **Dispatch** (needs `notifications:create`): recipient must exist. Content comes from an
  explicit `title`/`message` **or** a `template_code` (rendered with `context` —
  `{name}` → value); missing both → `422 CONTENT_REQUIRED`. Unknown template → `404`.
  Channels default to `["in_app"]`.
- Per channel: `in_app` is always `delivered`. Other channels are `delivered` (simulated)
  unless the user disabled that channel (`status=skipped`, reason `channel disabled`) or is
  within their quiet hours (`skipped`, reason `channel quiet`).
- **Inbox** is strictly the caller's own — `list_mine`, `get_mine`, `mark_read`,
  `mark_all_read`; another user's notification id → `404`.
- **Preferences** are the caller's own; a `community_id` in the body is scope-checked.
- Bad channel enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/notifications`. Full contract:
[`docs/backend/api/notifications.md`](../../api/notifications.md). Static routes
(`/me/preferences`, `/templates`, `/dispatch`, `/read-all`) are declared **before** the
`/{notification_id}` routes.

## Events

Audit (`audit_logs`, same transaction): `template.create` / `template.update`,
`notification.dispatch`. Wiring the other modules' audit-only events (visitor approved, dues
reminder, incident alert, …) into `dispatch` calls is the remaining integration work; the
Celery task in `tasks.py` is the async entry point.

## Seed

`seed_notifications()` — 3 templates per community (`visitor_approved` / `dues_reminder` /
`incident_alert`).

## Tests

`app/modules/notifications/tests/test_notifications_unit.py` (template render + multi-channel
deliver, content-required guard, disabled-channel skip, inbox read/read-all flow, unknown
template/recipient) and `test_notifications_api.py` (health, auth gate, resident cannot
dispatch, admin dispatch → resident reads, preferences round-trip).

# API — Dashboards (`/api/v1/dashboards`) — FR-14

Canonical envelope. All endpoints require a session and `dashboards:view`. Read-only. A
community-scoped caller is pinned to their own community; a global caller must pass
`?community_id=` (`422 COMMUNITY_REQUIRED`).

## Endpoints

| Method & path | Body | Success | Notes |
|---|---|---|---|
| `GET /dashboards/health` | – | `200` | liveness (session only) |
| `GET /dashboards/overview` | – | `200` `OverviewStats` | community KPIs |
| `GET /dashboards/security` | – | `200` `SecurityStats` | live gate / security posture |
| `GET /dashboards/financial` | – | `200` `FinancialStats` | billing rollups |
| `GET /dashboards/resident` | – | `200` `ResidentStats` | scoped to the caller's active occupancy |
| `GET /dashboards/assistant/quick-actions` | – | `200` `AssistantQuickActionsResponse` | role-tailored quick chips and suggestions |
| `POST /dashboards/assistant/query` | `AssistantQueryRequest` | `200` `AssistantResponse` | rule-based assistant & FAQ query |

All accept an optional `?community_id=` (required for a global caller).

## Response shapes

- **OverviewStats**: `community_id`, `residents`, `units`, `pending_visitor_requests`, `visitors_inside`, `pending_deliveries`, `open_tickets`, `open_incidents`, `active_panic_alerts`, `outstanding_balance` (decimal string).
- **SecurityStats**: `community_id`, `visitors_inside`, `vehicles_inside`, `staff_inside`, `pending_visitor_approvals`, `expected_visitors` (approved, still valid, not yet entered — FR-14), `active_panic_alerts`, `open_incidents`, `guards_on_active_roster`.
- **FinancialStats**: `community_id`, `invoices_by_status` (`{status: count}`), `total_billed`, `total_collected`, `outstanding_balance` (all decimal strings).
- **ResidentStats**: `community_id`, `unit_id` (nullable), `my_open_tickets`, `my_pending_visitor_requests`, `my_upcoming_bookings`, `my_outstanding_balance`, `published_announcements`.
- **AssistantQuickActionsResponse**: `community_id`, `greeting`, `chips` (`[{id, icon, label, query}]`), `suggested_queries`.
- **AssistantResponse**: `reply_text`, `category`, `actions` (`[{label, url, action_type}]`), `related_faqs`.


## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `COMMUNITY_REQUIRED`.

## Audit

None (read-only).

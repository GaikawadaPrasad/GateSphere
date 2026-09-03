# Module: Dashboards (FR-14)

> Canonical spec for the `dashboards` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Read-only **aggregate** views over every other module's data. **No dashboard tables** — the
service runs scoped `COUNT` / `SUM` queries. Four views: `overview`, `security`, `financial`,
`resident`.

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View any dashboard | `dashboards:view` | Community Admin, Facility Manager, Association Committee, Security Supervisor / Guard, Resident, Auditor, Super Admin |

`vendor_technician` and `domestic_staff` have **no** dashboard access.

## Data model

None. Every query is filtered by the viewer's community **before** aggregation
(`AGENTS.md §14`): a global caller must pass `?community_id=` (`422 COMMUNITY_REQUIRED`
otherwise); everyone else is pinned to their single community. The `resident` view further
narrows to the caller's own active occupancy.

## Views (service layer)

| View | Returns |
|------|---------|
| `overview` | `residents`, `units`, `pending_visitor_requests`, `visitors_inside`, `pending_deliveries`, `open_tickets`, `open_incidents`, `active_panic_alerts`, `outstanding_balance` |
| `security` | `visitors_inside`, `vehicles_inside`, `staff_inside`, `pending_visitor_approvals`, `active_panic_alerts`, `open_incidents`, `guards_on_active_roster` |
| `financial` | `invoices_by_status` (map), `total_billed` (non-draft), `total_collected` (successful payments), `outstanding_balance` |
| `resident` | the caller's `unit_id`, `my_open_tickets`, `my_pending_visitor_requests`, `my_upcoming_bookings`, `my_outstanding_balance`, `published_announcements` |
| `assistant/quick-actions` | role-tailored quick chips and suggestion prompts |
| `assistant/query` | keyword/intent-matched FAQ response with direct actions and dynamic balance/counts |

"Open ticket" = `{created, assigned, acknowledged, in_progress, resident_confirmation}`.
"Open incident" = `{reported, acknowledged, responding, contained}`.
"Outstanding balance" = `Σ balance_due` over `{posted, partially_paid, overdue}` invoices.

## API

Base path `/api/v1/dashboards`. Full contract:
[`docs/backend/api/dashboards.md`](../../api/dashboards.md).

## Events

None — read-only, no audit rows.

## Tests

`app/modules/dashboards/tests/test_dashboards_api.py` (health, auth gate, admin overview is
community-scoped with real counts + Decimal-as-string, security view types, financial view
shape, resident view resolves the caller's unit, vendor is `403`, assistant quick-actions,
assistant query intent matching).


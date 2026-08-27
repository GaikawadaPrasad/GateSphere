# Module: Complaint & Service Desk (FR-10)

> Canonical spec for the `complaints` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Resident service tickets with an **SLA-clocked** lifecycle, category-driven SLA policies
(config-as-data), append-only status history, assignment to an internal user **XOR** a vendor,
a message thread, and one feedback per ticket. Sits on `communities` (units).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View · post a message · confirm · give feedback | `complaints:view` | Super Admin, Community Admin, Facility Manager, Vendor/Technician, Resident, Auditor |
| Raise a ticket | `complaints:create` | Super Admin, Community Admin, Resident |
| Assign · transition (ack / in-progress / resolve / cancel) | `complaints:update` | Super Admin, Community Admin, Facility Manager, Vendor/Technician |
| Manage categories & SLA policies | `complaints:approve` | Super Admin, Community Admin |

## Data model

Owned tables (`docs/database/schema.md §09`), migration `0013`.

| Table | Notes |
|-------|-------|
| `service_categories` | UQ `(community_id, code)`, UQ `(id, community_id)`. `default_priority` ∈ low·medium·high·critical. Tenant + RLS. |
| `sla_policies` | Composite tenant-safe FK to `service_categories`. UQ `(community_id, category_id, priority)`. `response_minutes` / `resolution_minutes` / `escalation_minutes`. Config-as-data. Tenant + RLS. |
| `service_tickets` | Composite tenant-safe FKs to `units` and `service_categories` (`ON DELETE RESTRICT` — a category in use cannot be dropped). UQ `(community_id, ticket_number)`, UQ `(id, community_id)`. `status` ∈ created·assigned·acknowledged·in_progress·resolved·resident_confirmation·closed·reopened·cancelled. SLA clocks: `first_response_due_at`, `resolution_due_at`, `escalation_due_at`, plus `first_responded_at`, `sla_breached_at`, `resolved_at`, `closed_at`. Tenant + RLS. |
| `ticket_status_history` | **Append-only** — every transition, `from_status → to_status`. |
| `ticket_assignments` | `CHECK (assigned_to_user_id IS NOT NULL) <> (vendor_name IS NOT NULL)` — executor XOR. One `is_active` row per ticket (service rule). |
| `ticket_messages` | `is_internal` hides a note from the resident (UI concern). |
| `ticket_feedback` | UQ `ticket_id`, `CHECK rating BETWEEN 1 AND 5`. |

## Business rules (service layer)

- Scoped to the caller's **active community**. Cross-tenant unit / category → `404`.
- **Create**: priority defaults to the category's `default_priority`; the matching
  `(category, priority)` SLA policy stamps the three due-dates. `ticket_number` = `TKT-<year>-<seq>`.
- **Lifecycle** (`_TRANSITIONS`): `created → assigned → acknowledged → in_progress → resolved`
  then automatically `→ resident_confirmation`. `cancelled` is reachable from any pre-resolved
  state. `closed` and `reopened` are **not** reachable through `transition` — they only happen
  via `confirm`:
  - `confirm("confirmed")` → `closed` + `closed_at`.
  - `confirm("disputed")` → `reopened` (+ `resident_confirmation_status = disputed`).
  - **A ticket is never closed without resident confirmation.**
- First response (`assign`, first non-internal staff message, or `acknowledged`/`in_progress`)
  stamps `first_responded_at`; if past `first_response_due_at`, sets `sla_breached_at`. Same
  check against `resolution_due_at` at resolve time.
- **Assign**: internal user XOR vendor (schema + DB CHECK); the prior active assignment is
  deactivated. Assigning a `created` / `reopened` ticket moves it to `assigned`.
- **Feedback**: only when `status = closed` (`422 TICKET_NOT_CLOSED`), once per ticket
  (`409 FEEDBACK_EXISTS`).
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/complaints`. Full contract:
[`docs/backend/api/complaints.md`](../../api/complaints.md). `/categories`, `/sla` are declared
before `/tickets/*`.

## Events

Audit (`audit_logs`, same transaction): `category.create` / `category.update`, `sla.create` /
`sla.update`, `ticket.create`, `ticket.assign`, `ticket.<status>`, `ticket.confirm`,
`ticket.message`, `ticket.feedback`. Escalation sweep (past `escalation_due_at`) and resident
notifications land with FR-15. `ticket_attachments` (schema §09) is deferred.

## Seed

`seed_complaints()` — 4 categories (PLUMB / ELEC / HOUSE / LIFT) each with a matching SLA
policy, per community.

## Tests

`app/modules/complaints/tests/test_complaints_unit.py` (SLA clock inheritance, full lifecycle
+ history trail, no-close-without-confirmation, disputed → reopened, executor XOR, feedback
gating) and `test_complaints_api.py` (health, auth gate, resident→FM→resident end-to-end,
category create needs `complaints:approve`, cross-community 404).

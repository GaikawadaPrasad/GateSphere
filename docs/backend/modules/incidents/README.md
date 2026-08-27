# Module: Emergency & Incident Management (FR-13)

> Canonical spec for the `incidents` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Security incidents — optionally raised from an FR-05 panic alert — with an SLA-agnostic
response lifecycle, append-only status history and operational **action log**, and responder
**assignments**. Sits on `communities` (towers/units/gates), `gate` (`panic_alerts`), `users`.

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View (incidents, history, actions, assignments) | `incidents:view` | Resident, Security Guard/Supervisor, Community Admin, Association Committee, Super Admin, Auditor |
| Report an incident | `incidents:create` | Resident, Security Guard/Supervisor, Community Admin, Super Admin |
| Update details · transition · assign/release · log actions | `incidents:update` | Security Supervisor, Community Admin, Super Admin |

## Data model

Owned tables (`docs/database/schema.md §13`), migration `0016`.

| Table | Notes |
|-------|-------|
| `security_incidents` | UQ `(community_id, incident_number)`, UQ `(id, community_id)`. `incident_type` ∈ medical·fire·theft·suspicious·breach·lift_entrapment·assault·natural·other; `severity` ∈ low·medium·high·critical; `status` ∈ reported·acknowledged·responding·contained·resolved·closed·false_alarm. Optional `panic_alert_id → panic_alerts` (SET NULL), `tower_id`/`unit_id`/`gate_id` (SET NULL). Tenant + RLS. |
| `incident_status_history` | **Append-only** — every transition (`old_status → new_status`). Tenant + RLS. |
| `incident_assignments` | Responder ↔ incident, `is_active` + `released_at`. |
| `incident_actions` | **Append-only** operational log. `action_type` ∈ note·dispatch·escalation·authority_contacted·evacuation·medical_aid·update. |

## Business rules (service layer)

- Scoped to the caller's **active community** (`COMMUNITY_REQUIRED` if a global caller omits
  it). `tower_id` / `unit_id` / `gate_id` / `panic_alert_id` are all resolved **within scope**
  — cross-tenant → `404`.
- `incident_number` = `INC-<year>-<seq>`; creation writes the first history row.
- **Lifecycle** (`_TRANSITIONS`): `reported → acknowledged → responding → {contained, resolved}`;
  `contained → resolved`; `resolved → closed` (or back to `responding`); `false_alarm` from
  the early states. Anything else → `422 INVALID_TRANSITION`.
- **Resolve** requires a `resolution_summary` (`422 SUMMARY_REQUIRED`) and stamps `resolved_at`.
- `update` / `assign` / `add_action` are refused once `closed` / `false_alarm`.
- **Assign**: responder must exist; one active assignment per `(incident, user)`
  (`409 ALREADY_ASSIGNED`). `release` sets `is_active=false` (`422 ALREADY_RELEASED` on repeat).
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/incidents`. Full contract:
[`docs/backend/api/incidents.md`](../../api/incidents.md). `/assignments/{assignment_id}/release`
is a static prefix declared alongside the `/{incident_id}/…` routes.

## Events

Audit (`audit_logs`, same transaction): `incident.create`, `incident.update`,
`incident.<status>`, `incident.assign`, `incident.release`, `incident.action`. Push/SMS
alerting of responders and the association lands with FR-15. `incident_attachments`
(schema §13) is deferred.

## Seed

`seed_incidents()` — one resolved "suspicious / unattended bag" incident per community.

## Tests

`app/modules/incidents/tests/test_incidents_unit.py` (numbering + initial history, full
lifecycle + resolve-needs-summary + closed is terminal, bad transition, assign/release +
duplicate guard, append-only action log) and `test_incidents_api.py` (health, auth gate,
resident-report → supervisor-handle end-to-end, resident cannot transition, cross-community
gate reference 404).

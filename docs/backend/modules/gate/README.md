# Module: Gate / Security Operations (FR-05)

> Canonical spec for the `gate` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

The security desk's operational backbone: an **append-only gate event log** (shared by the
visitor / delivery / staff / vehicle flows), guard **rosters**, **gate assignments**, and
**panic (SOS) alerts**. Sits on `communities` (gates) and `users` (guards / supervisors).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View (events, rosters, assignments, alerts) | `gate:view` | Super Admin, Community Admin, Security Supervisor, Security Guard, Facility Manager, Auditor, Domestic Staff / Vendor (own community) |
| Log a gate event / create roster / create assignment | `gate:create` | Super Admin, Community Admin, Security Supervisor, Security Guard |
| Update roster · end assignment · acknowledge / resolve an alert | `gate:update` | Super Admin, Community Admin, Security Supervisor |
| **Raise** a panic alert | *authenticated session only* | any role (residents included — SOS) |
| **Cancel** a panic alert | *the user who raised it* | — |

## Data model

Owned tables (`docs/database/schema.md §04`), migration `0008`, all tenant-scoped + RLS.

| Table | Notes |
|-------|-------|
| `gate_events` | **Append-only** — the service has no update/delete path. `event_type` ∈ visitor_in·visitor_out·delivery_in·delivery_out·staff_in·staff_out·vehicle_in·vehicle_out·patrol_check·manual_note·gate_open·gate_close. `reference_type` / `reference_id` link to the originating record. `metadata` JSONB (ORM attr `event_metadata`). Index `(community_id, gate_id, occurred_at)`. |
| `guard_rosters` | UQ `(community_id, guard_user_id, shift_date, shift_start)`. UQ `(id, community_id)`. `status` ∈ planned·active·completed·cancelled. |
| `gate_assignments` | Guard ↔ gate for a shift window. `status` ∈ active·ended. One `active` assignment per guard at a time (service rule). |
| `panic_alerts` | `alert_type` ∈ medical·fire·security·intrusion·other; `severity` ∈ low·medium·high·critical; `status` ∈ active·acknowledged·resolved·cancelled. `acknowledged_by`+`acknowledged_at` set together. |

## Business rules (service layer)

- Everything is scoped to the caller's **active community** — resolved from a single-community
  `TenantScope`, from the referenced gate's community, or from an explicit `?community_id=`
  (`COMMUNITY_REQUIRED` if a global caller gives none and no gate).
- A referenced `gate_id` / `roster_id` outside scope is a `404`, never a `403`.
- **Events** are immutable — `log_event` inserts and audits; nothing edits them.
- **Roster** status machine: `planned → {active, cancelled}`, `active → {completed, cancelled}`.
  Anything else → `422 INVALID_TRANSITION`. `shift_end > shift_start` (`422 INVALID_TIME_RANGE`).
  Duplicate shift → `409 ROSTER_EXISTS`.
- **Assignment**: one `active` per guard → `409 ASSIGNMENT_ACTIVE`. `end` sets `ended` +
  stamps `assigned_to`; a second `end` → `422 ALREADY_ENDED`.
- **Panic alert** machine: `active → acknowledged → resolved`; `resolve` from `active` also
  back-fills the acknowledgement. `cancel` allowed from `active` / `acknowledged` and only by
  `triggered_by_user_id` (`403 NOT_ALERT_OWNER`). Any other move → `422 INVALID_TRANSITION`.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/gate`. Full contract: [`docs/backend/api/gate.md`](../../api/gate.md).

## Events

Audit only (`audit_logs`, same transaction): `event.log`, `roster.create`, `roster.update`,
`assignment.create`, `assignment.end`, `alert.raise`, `alert.acknowledge`, `alert.resolve`,
`alert.cancel`. Real-time alert fan-out to on-duty guards lands with FR-15.

## Seed

`seed_gate()` — one active roster + gate assignment + a `gate_open` event per community,
for the demo `security_guard`.

## Tests

`app/modules/gate/tests/test_gate_unit.py` (event community derivation, enum guard, roster
machine, duplicate roster, one-active-assignment, end-assignment, alert lifecycle, owner-only
cancel) and `test_gate_api.py` (health, auth gate, guard logs+lists an event, resident raises
but cannot acknowledge, supervisor ack/resolve, cross-community gate 404, roster create).

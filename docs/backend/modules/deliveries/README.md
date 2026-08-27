# Module: Delivery Management (FR-07)

> Canonical spec for the `deliveries` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Per-community **delivery protocols** (config-as-data), delivery records with an approval +
arrival + completion workflow, and an append-only `delivery_events` log. Sits on `communities`
(units, gates) and `residents` (primary occupant → resident resolution).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View (deliveries, protocols, events) | `deliveries:view` | Super Admin, Community Admin, Security Supervisor / Guard, Resident, Auditor |
| Log a delivery | `deliveries:create` | Super Admin, Community Admin, Security Supervisor / Guard, Resident |
| Record arrival / mark delivered / cancel | `deliveries:update` | Super Admin, Community Admin, Security Supervisor / Guard |
| Approve / reject a delivery · edit protocols | `deliveries:approve` | Super Admin, Community Admin, **Resident** (their unit) |

## Data model

Owned tables (`docs/database/schema.md §06`), migration `0010`.

| Table | Notes |
|-------|-------|
| `delivery_protocols` | **DB source of truth** — UQ `(community_id, delivery_type)`, UQ `(id, community_id)`. `protocol_type` ∈ leave_at_gate·collect_at_gate·direct_to_door·call_resident. `requires_otp`, `allow_direct_entry`, `leave_at_gate`, optional `allowed_start/end_time`. Tenant-scoped + RLS. |
| `deliveries` | Composite tenant-safe FKs `(unit_id, community_id) → units`, `(protocol_id, community_id) → delivery_protocols`. UQ `(id, community_id)`. `delivery_type` ∈ food·grocery·ecommerce·courier·medicine·laundry·other. `approval_status` ∈ pending·approved·rejected·auto_approved. `status` ∈ expected·at_gate·in_transit·delivered·collected·returned·cancelled. Tenant-scoped + RLS. |
| `delivery_events` | **Append-only**; reached only via its parent delivery (no tenant column). `event_type` ∈ logged·arrived·approved·rejected·entered·delivered·exited. `metadata` JSONB (`event_metadata`). |

## Business rules (service layer)

- Everything is scoped to the caller's **active community** (single-community scope, referenced
  unit's community, or `?community_id=`; `COMMUNITY_REQUIRED` otherwise). Cross-tenant unit /
  gate → `404`.
- **Protocol** for the `delivery_type` is auto-created with a safe default
  (`collect_at_gate`, no direct entry) if the community has not configured one.
- **Create**: `approval_status = auto_approved` when the protocol has
  `allow_direct_entry AND NOT requires_otp`, else `pending`. Resident = the unit's primary
  active occupant. Emits a `logged` event.
- **Decision**: only on a `pending` delivery (`422 INVALID_TRANSITION`); `rejected` also sets
  `status = cancelled`.
- **Arrival**: requires `approval_status ∈ {approved, auto_approved}` (`422 NOT_APPROVED`) and
  `status ∈ {expected, at_gate}`; sets `at_gate` + `arrived_at`.
- **Delivered**: from `at_gate` / `in_transit`; final status is `delivered` when the protocol
  says *not* `leave_at_gate`, otherwise `collected`.
- **Cancel**: any non-terminal delivery → `cancelled`.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/deliveries`. Full contract:
[`docs/backend/api/deliveries.md`](../../api/deliveries.md). `/health` and `/protocols` are
declared **before** the `""` / `/{delivery_id}` routes.

## Events

Audit (`audit_logs`, same transaction): `protocol.create` / `protocol.update`,
`delivery.create`, `delivery.approved` / `delivery.rejected`, `delivery.arrived`,
`delivery.delivered`, `delivery.cancel`. Plus the in-table `delivery_events` timeline.

## Seed

`seed_deliveries()` — 3 protocol presets per community (food = collect, ecommerce = leave at
gate, courier = OTP).

## Tests

`app/modules/deliveries/tests/test_deliveries_unit.py` (protocol upsert idempotency,
direct-entry auto-approve, default-protocol approval + arrival gate, full lifecycle event
trail, rejected → cancelled) and `test_deliveries_api.py` (health, auth gate, guard-log →
resident-approve → guard-complete, protocol edit needs `deliveries:approve`, cross-community
unit 404).

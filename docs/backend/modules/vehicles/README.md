# Module: Vehicle & Parking (FR-08)

> Canonical spec for the `vehicles` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Vehicle registry (resident **XOR** visitor owned), parking slots + active allocations,
automated gate plate logging, parking violations, and per-community parking rules
(config-as-data). Sits on `communities` (towers, gates), `residents`, `visitors`.

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View | `vehicles:view` | Super Admin, Community Admin, Security Supervisor / Guard, Resident, Auditor |
| Register vehicle · log gate entry · report violation | `vehicles:create` | Super Admin, Community Admin, Security Supervisor / Guard, Resident |
| Update vehicle · log exit · release allocation · transition violation | `vehicles:update` | Super Admin, Community Admin, Security Supervisor / Guard |
| Edit parking rules · create slot · allocate slot | `vehicles:approve` | Super Admin, Community Admin |

## Data model

Owned tables (`docs/database/schema.md §07`), migration `0011`, all tenant-scoped + RLS.

| Table | Notes |
|-------|-------|
| `vehicles` | UQ `(community_id, registration_number)` (plate stored upper-cased), UQ `(id, community_id)`. **`CHECK (resident_profile_id IS NOT NULL) <> (visitor_id IS NOT NULL)`** — owner XOR. |
| `parking_rules` | UQ `(community_id)` — config-as-data: `allow_multi_slot_vehicle`, `allow_guest_parking`, `max_active_slots_per_unit`, `violation_grace_minutes`. Auto-created on first read. |
| `parking_slots` | UQ `(community_id, slot_code)`, UQ `(id, community_id)`. `slot_type` ∈ car·bike·ev·visitor·accessible; `status` ∈ available·allocated·reserved·blocked. |
| `parking_allocations` | Composite tenant-safe FKs to slots + vehicles. **Partial-unique** `uq_parking_slot_active` and `uq_parking_vehicle_active` (`status='active'`). `CHECK allocated_to > allocated_from`. |
| `vehicle_entries` | Plate-indexed automated log. `is_flagged` when the plate is not in the registry. One open (`status='inside'`) entry per plate. `CHECK exit_at >= entry_at`. |
| `parking_violations` | `violation_type` ∈ wrong_slot·no_sticker·blocking·unauthorized·expired_pass·other; `status` ∈ open·acknowledged·resolved·waived. |

## Business rules (service layer)

- Everything is scoped to the caller's **active community** (`COMMUNITY_REQUIRED` if a global
  caller omits `?community_id=`). Cross-tenant slot / vehicle / gate → `404`.
- **Vehicle**: owner XOR enforced in the schema *and* the DB. Plate upper-cased; dup →
  `409 VEHICLE_EXISTS`.
- **Allocation**: one active per slot (`409 SLOT_TAKEN`) and — unless
  `allow_multi_slot_vehicle` — one active per vehicle (`409 VEHICLE_HAS_SLOT`); a unit cannot
  exceed `max_active_slots_per_unit` (`422 UNIT_SLOT_LIMIT`). Allocating sets the slot
  `allocated`; releasing sets it `available`.
- **Gate entry**: unknown plate → row created with `is_flagged=true`. One open entry per plate
  (`409 ALREADY_INSIDE`). Exit needs an open row (`422 NOT_INSIDE`).
- **Violation** machine: `open → {acknowledged, resolved, waived}`,
  `acknowledged → {resolved, waived}`; `resolved` / `waived` stamp `resolved_at`. Anything
  else → `422 INVALID_TRANSITION`.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/vehicles`. Full contract: [`docs/backend/api/vehicles.md`](../../api/vehicles.md).
`/health`, `/parking/*`, `/entries/*` are declared **before** the `""` / `/{vehicle_id}` routes.

## Events

Audit only (`audit_logs`, same transaction): `rule.update`, `vehicle.register`,
`vehicle.update`, `slot.create`, `allocation.create`, `allocation.release`, `entry.create`,
`entry.exit`, `violation.report`, `violation.{acknowledged,resolved,waived}`.

## Seed

`seed_vehicles()` — a `parking_rules` row, 5 slots, and one resident car per community.

## Tests

`app/modules/vehicles/tests/test_vehicles_unit.py` (owner-XOR schema guard, dup plate,
single active allocation per slot & vehicle + release, unknown-plate flag + one-open-entry,
violation machine) and `test_vehicles_api.py` (health, auth gate, resident registers,
guard plate entry/exit, slot create needs `vehicles:approve`, cross-community 404).

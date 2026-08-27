# Module: Amenity Booking (FR-11)

> Canonical spec for the `amenities` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Community amenities (clubhouse, gym, pool, …), weekly availability **slots**, config-as-data
**booking rules**, maintenance **blocks**, and resident **bookings** with an atomic
overlap/capacity check. Sits on `communities` (units) and `residents` (occupancy → the
booker's unit).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View · book · cancel own booking | `amenities:view` (+ `:create` to book) | Resident, Facility Manager, Community Admin, Super Admin, Auditor |
| Mark booking completed / no_show · add maintenance block | `amenities:update` | Facility Manager, Community Admin, Super Admin |
| Create/edit amenities · slots · rules | `amenities:approve` | Community Admin, Super Admin |

## Data model

Owned tables (`docs/database/schema.md §11`), migration `0014`, all tenant-scoped + RLS.

| Table | Notes |
|-------|-------|
| `amenities` | UQ `(community_id, code)`, UQ `(id, community_id)`. `amenity_type` ∈ clubhouse·gym·pool·tennis·hall·guest_room·park·other. `capacity` = concurrent participant capacity. |
| `amenity_slots` | Composite tenant-safe FK to amenities. Weekly: `day_of_week` 0–6 (Mon–Sun), `start_time`/`end_time` (`CHECK end > start`), optional per-slot `capacity` + `fee`. |
| `amenity_rules` | Config-as-data. UQ `(community_id, amenity_id, rule_type)`. `rule_type` ∈ max_advance_days·max_active_per_unit·min_cancel_hours·max_hours_per_booking; `rule_value` JSONB `{"value": N}`. |
| `amenity_blocks` | Maintenance windows, `CHECK blocked_to > blocked_from`. |
| `amenity_bookings` | Composite tenant-safe FKs to amenities + units. `CHECK end_at > start_at`. `status` ∈ confirmed·cancelled·completed·no_show. |

## Business rules (service layer)

- Scoped to the caller's **active community**. Cross-tenant amenity / slot → `404`.
- **Book**: `slot` must belong to the amenity and be active; `booking_date.weekday()` must
  equal `slot.day_of_week` (`422 SLOT_WEEKDAY_MISMATCH`); date not in the past. `start_at` /
  `end_at` are `booking_date` + slot times (UTC). The booker's unit comes from their active
  occupancy (`422 NO_UNIT` if none). `amount = slot.fee`.
- **Rules** (all optional, from `amenity_rules`): `max_advance_days` → `422 TOO_FAR_AHEAD`;
  `max_hours_per_booking` → `422 TOO_LONG`; `max_active_per_unit` → `422 UNIT_BOOKING_LIMIT`;
  `min_cancel_hours` → `422 TOO_LATE_TO_CANCEL` (residents only; staff bypass).
- **Atomic conflict check**: `SELECT … FOR UPDATE` on the amenity row, then reject any
  overlapping maintenance block (`409 AMENITY_BLOCKED`), then require
  `Σ participant_count(overlapping confirmed) + new ≤ (slot.capacity or amenity.capacity)`
  (`409 SLOT_FULL`).
- **Cancel**: only a `confirmed` booking; the owner or an `amenities:update` holder. Owner is
  also subject to `min_cancel_hours`.
- **completed / no_show**: `amenities:update` only, from `confirmed`.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/amenities`. Full contract:
[`docs/backend/api/amenities.md`](../../api/amenities.md). `/bookings/*` is declared **before**
the `""` / `/{amenity_id}` routes; `/slots/{slot_id}` DELETE is a static prefix.

## Events

Audit only (`audit_logs`, same transaction): `amenity.create` / `amenity.update`,
`slot.create` / `slot.disable`, `rule.create` / `rule.update`, `block.create`,
`booking.create`, `booking.cancel`, `booking.completed` / `booking.no_show`.

## Seed

`seed_amenities()` — CLUB + GYM per community, each with a slot for every weekday and
`max_advance_days=14` / `max_active_per_unit=3` rules. `seed_residents()` now also links the
demo `resident@gatesphere.com` account to a unit so bookings work out of the box.

## Tests

`app/modules/amenities/tests/test_amenities_unit.py` (window/amount computation, weekday
mismatch, capacity across overlapping bookings, maintenance block, `max_advance_days` rule,
cancel frees capacity) and `test_amenities_api.py` (health, auth gate, resident book→cancel,
amenity create needs `amenities:approve`, cross-community 404).

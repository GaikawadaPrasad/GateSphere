# Module: Residents (FR-03)

> Canonical spec for the `residents` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Owner / tenant / family-member records, unit occupancy mapping, emergency contacts, and the
statutory move-in / move-out clearance workflow. Sits on the `communities` master data.

## Users & Permissions

| Action | Roles |
|--------|-------|
| View   | `residents:view` — Super Admin, Community Admin, Association Committee, Facility Manager, Security roles (scoped), Auditor |
| Create / Update | `residents:create` / `residents:update` — Super Admin, Community Admin, **within the caller's active community** |
| Delete (emergency contact) | `residents:delete` |

The `resident` role itself has **no** `residents:*` permission — managing profiles is an admin action.

## Data model

Owned tables (`docs/database/schema.md §02`), all tenant-scoped, all with composite tenant-safe
FKs to their parents:

| Table | Notes |
|-------|-------|
| `resident_profiles` | UQ `(community_id, user_id)` — one profile per user per community. UQ `(id, community_id)` (FK target). `profile_status` ∈ pending·active·moved_out·suspended; `kyc_status` ∈ not_started·submitted·verified·rejected |
| `unit_occupancies` | FK `(unit_id, community_id) → units`, `(resident_profile_id, community_id) → resident_profiles`. **Partial unique index** `uq_unit_primary_active` = one `is_primary AND is_active` occupant per unit. `occupancy_role` ∈ primary_owner·secondary_owner·tenant·family·occupant |
| `family_members` | FK to unit + primary resident profile. `relationship` ∈ spouse·child·parent·sibling·relative·domestic_help·other |
| `emergency_contacts` | FK to resident profile. `priority` 1–10 |
| `move_records` | FK to unit + resident profile. `move_type` ∈ move_in·move_out; `status` ∈ requested·scheduled·approved·completed·rejected·cancelled |

Also adds UQ `(id, community_id)` to `units` — migration `0006`. RLS enabled on all five new tables.

## Business rules (service layer)

- All entities are created in the caller's **active community**, resolved from `TenantScope`
  (a single-community non-global scope) or from an explicit `?community_id=` for a global scope.
  `COMMUNITY_REQUIRED` if a global caller omits it.
- The referenced `user`, `unit`, and `resident_profile` are all resolved **within scope** — a
  cross-tenant reference is a `404`, never a `403`.
- One profile per `(community, user)` → `409 PROFILE_EXISTS`.
- A resident can have only one active occupancy per unit → `409 OCCUPANCY_EXISTS`.
- One primary active occupant per unit → `409 PRIMARY_OCCUPANT_EXISTS` (also a DB partial-unique index).
- Ending an occupancy requires `end_date > start_date` (`422 INVALID_DATE_RANGE`) and sets `is_active=False`.
- Move-record status machine (`_MOVE_TRANSITIONS`): `requested → {scheduled, rejected, cancelled}`,
  `scheduled → {approved, rejected, cancelled}`, `approved → {completed, cancelled}`. Anything else
  → `422 INVALID_TRANSITION`. `approve` stamps `approved_by_user_id` + `approved_at`. A `completed`
  `move_out` deactivates that resident's active occupancy on the unit.
- Bad enum value anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/residents`. Full contract: [`docs/backend/api/residents.md`](../../api/residents.md).
Static-prefix routes (`/move-records`, `/occupancies`, `/units/...`, `/emergency-contacts/...`,
`/family-members`) are declared **before** the `/{profile_id}` catch-all.

## Events

- Emails / notifications: none yet (move-in approval should notify — TODO).
- Background jobs: none.
- **Audit** (`audit_logs`, same transaction): `profile.create/update`, `occupancy.create/end`,
  `family.create`, `contact.create/delete`, `move.create/transition`.

## Dependencies

`communities` (`Unit` lookup), `users` (RBAC + user existence), `audit`, `app.core.tenancy`,
`app.db.repository`.

## Failure scenarios

`401 NOT_AUTHENTICATED` · `403 PERMISSION_DENIED` · `404 NOT_FOUND` (incl. cross-tenant) ·
`409 PROFILE_EXISTS / OCCUPANCY_EXISTS / PRIMARY_OCCUPANT_EXISTS` ·
`422 VALIDATION_ERROR / INVALID_ENUM / INVALID_DATE_RANGE / INVALID_TRANSITION / COMMUNITY_REQUIRED`.

## Ownership

Backend owner: _TBD_ · Web owner: _TBD_ · Docs owner: _TBD_

## Files

`backend/app/modules/residents/{models,schemas,repository,service,deps,router}.py` ·
migration `0006_residents` · tests `tests/test_residents_{unit,api}.py`.

# Module: Domestic Staff (FR-06)

> Canonical spec for the `domestic_staff` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Directory of household workers (maids, cooks, drivers, …), their **multi-unit** work
assignments, gate **attendance** (check-in / check-out), and resident **ratings**. Sits on
`communities` (units, gates).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View (directory, assignments, attendance, ratings) | `domestic_staff:view` | Super Admin, Community Admin, Security Supervisor / Guard, Resident, Auditor |
| Add a staff record · record a gate check-in / rate staff | `domestic_staff:create` | Super Admin, Community Admin, Security Supervisor / Guard, Resident |
| Update a staff record · check-out · end an assignment | `domestic_staff:update` | Super Admin, Community Admin, Security Supervisor / Guard |
| Approve a unit assignment | `domestic_staff:approve` | Super Admin, Community Admin |

## Data model

Owned tables (`docs/database/schema.md §05`), migration `0009`, all tenant-scoped + RLS,
composite tenant-safe FKs to `units` and `domestic_staff`.

| Table | Notes |
|-------|-------|
| `domestic_staff` | UQ `(community_id, phone)`, UQ `(id, community_id)`. `id_number_hash` HMAC only. `staff_type` ∈ maid·cook·driver·nanny·caretaker·gardener·nurse·other; `police_verification_status` ∈ not_started·pending·verified·rejected·expired. |
| `staff_unit_assignments` | **Partial unique index** `uq_staff_unit_active` = one active row per `(staff, unit)`. `CHECK start_date <= end_date`. `work_type` ∈ full_time·part_time·on_call·daily_help. |
| `staff_attendance` | **Partial unique index** `uq_staff_attendance_open` = at most one open row per staff. `CHECK check_out_at >= check_in_at`. `attendance_status` ∈ inside·left·absent. |
| `staff_ratings` | UQ `(staff_id, unit_id, resident_user_id)` — one rating per resident, re-rating updates in place. `CHECK rating BETWEEN 1 AND 5`. |

## Business rules (service layer)

- Everything is scoped to the caller's **active community** (single-community scope, referenced
  staff's community, or `?community_id=`; `COMMUNITY_REQUIRED` otherwise).
- Referenced `staff_id` / `unit_id` / `gate_id` outside scope → `404`, never `403`.
- One staff per phone per community → `409 STAFF_EXISTS`.
- Assignment: `start_date <= end_date` (`422 INVALID_DATE_RANGE`); one active per `(staff, unit)`
  → `409 ASSIGNMENT_EXISTS`; `end` sets `is_active=false` + stamps `end_date`, second end →
  `422 ALREADY_ENDED`.
- Attendance: one open row per staff → `409 ALREADY_INSIDE`; `check_out` needs an open row
  (`422 NOT_INSIDE`).
- Rating: upsert on `(staff, unit, resident)`; `rating` 1–5.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/domestic-staff`. Full contract:
[`docs/backend/api/domestic-staff.md`](../../api/domestic-staff.md). Static-prefix routes
(`/assignments`, `/attendance`, `/ratings`, `/health`) and `/{staff_id}/ratings` are declared
**before** the `""` / `/{staff_id}` routes.

## Events

Audit only (`audit_logs`, same transaction): `staff.create`, `staff.update`,
`assignment.create`, `assignment.end`, `attendance.check_in`, `attendance.check_out`,
`rating.create`, `rating.update`.

## Seed

`seed_domestic_staff()` — 3 staff per community + one active unit assignment.

## Tests

`app/modules/domestic_staff/tests/test_domestic_staff_unit.py` (duplicate phone, enum guard,
one-active-assignment, end→reassign, attendance cycle, rating upsert) and
`test_domestic_staff_api.py` (health, auth gate, admin creates + guard check-in/out,
auditor cannot create, resident rates, cross-community 404).

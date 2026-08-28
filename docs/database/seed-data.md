# Database — Seed Data

`python -m app.scripts.seed` (aka `make seed`) loads an **idempotent** synthetic
dataset. It runs automatically on `make up`. Re-running only fills gaps — every
block is guarded by a natural-key or prefix lookup, so it never duplicates rows.

Per the PRD/SRS: _"empty screens are strictly prohibited"_ and the demo must show
_"active maintenance invoices, payment records, service complaints, amenity
bookings … sufficient to demonstrate every module end-to-end."_ The seed is
therefore split into two layers.

## 1. Configuration & directory layer (`seed_*` functions)

| Function | Produces |
|---|---|
| `seed_rbac` | 10 roles, full permission catalogue, role→permission grants |
| `seed_property` | 2 communities (`gs-01`, `gs-02`), 2 gates each, 4 towers, 8 floors, 56 units |
| `seed_users` | one demo user per role — `<role>@gatesphere.com` / `<role>@Gate2026!` |
| `seed_residents` | 6 resident profiles + occupancies + emergency contacts per community; links the demo `resident@` account to the 7th unit of `gs-01` |
| `seed_visitors` | visitor policy + 3 known visitors per community |
| `seed_gate` | active guard roster + gate assignment + a `gate_open` event |
| `seed_domestic_staff` | 3 staff (maid/cook/driver) + 1 unit assignment |
| `seed_deliveries` | 3 delivery-protocol presets (food / ecommerce / courier) |
| `seed_vehicles` | parking rule + 5 slots + 1 resident vehicle per community |
| `seed_complaints` | 4 service categories + matching SLA policies |
| `seed_billing` | billing rule (18% tax) + 3 charge heads (MAINT / WATER / SINK) |
| `seed_amenities` | Clubhouse + Gym, per-weekday slots, booking rules |
| `seed_communication` | 1 published "Welcome to GateSphere" announcement |
| `seed_incidents` | 1 resolved security incident (`INC-2026-00001`) |
| `seed_notifications` | 3 notification templates |

## 2. Operational layer (`seed_operations`) — FR-17

Written **directly via the ORM** (not the service layer) so the seed stays
deterministic and free of request/audit/notification side effects. Idempotency is
keyed on this seed's own invoice-number prefix (`INV-<cc>-2026-%`), so a partially
populated dev database still gets its remaining operational rows on the next run.

Per community:

| Module | Rows |
|---|---|
| Billing | 3 maintenance invoices — one `paid`, one `partially_paid`, one `posted` (unpaid) — each with 2 line items; matching `payments` + allocations for the paid / part-paid ones |
| Complaints | 3 service tickets spanning the lifecycle (`created`, `in_progress`, `resolved`) with full status history |
| Amenities | 2 upcoming `confirmed` bookings (Clubhouse, Gym) |
| Deliveries | 3 deliveries (`expected`, `at_gate`, `delivered`) across the three protocols |
| Visitors | 1 guest currently inside (`entered` + open `visitor_entry`), 1 completed visit (`completed` + closed entry) |
| Vehicles | 1 active `parking_allocation`; 2 `vehicle_entries` (one inside, one exited) |
| Domestic staff | 2 `staff_attendance` rows — one on-site (open), one checked-out |
| Gate | 1 resolved `panic_alert` with acknowledge + resolution timestamps |

All operational rows attach to seeded resident units, so the resident portal
(`resident@gatesphere.com`) shows a populated dashboard: an outstanding invoice,
an open ticket, an upcoming amenity booking and an in-flight delivery.

## Resetting

`make seed` is safe to re-run. For a clean slate, drop the volume
(`docker compose down -v && make up`) which re-migrates and re-seeds from scratch.

# Session Notes

The living continuity log required by [`AGENTS.md §18`](../../AGENTS.md). Record meaningful changes
**as you go**, newest first. The next session (human or AI) reads this + `git status` / `git log`
before continuing. This is not `docs/decisions/` (ADRs) or a changelog — it is working context.

Format per entry:

```
## YYYY-MM-DD — <short title>
**By:** <who>
**Branch / commit:** <ref>
**What changed:** …
**Why:** …
**Verified:** <what was actually run>
**Open / next:** …
```

---

## 2026-08-28 — FR-02 User/role management + FR-16 Audit read API

**By:** post-module integration/polish, item 3 of the "still open" list
**Branch / commit:** `main`
**What changed:**
- **`users` module** — real management API on the existing RBAC tables (no migration):
  `GET /users` (filters), `POST /users` (+ inline role grant), `GET/PATCH /users/{id}`,
  `POST /users/{id}/roles`, `DELETE /users/{id}/roles/{grant}`, `GET /users/roles` (roles +
  effective permission codes). Scoped: a community admin only sees users with no grants or a
  grant in their community; grants can only target a community in scope; `super_admin` /
  `auditor` stay platform-global. **Every grant / revoke / deactivate calls
  `revoke_all_user_sessions`.** `users:{view,create,update,delete}` — community_admin has them,
  auditor does not.
- **`audit` module** — read-only query API on `audit_logs` (no migration):
  `GET /audit/logs` (filter by module/action/entity/user/date + `?community_id=`),
  `GET /audit/logs/{id}`, `GET /audit/logs.csv` (`audit:export`, 10k cap). Community-scoped;
  Community Admin still has no `audit:*` by design.
- docs: `docs/backend/api/users.md`, `docs/backend/api/audit.md`; AGENTS.md §23 table + gaps.
**Why:** FR-02 + FR-16 from `AGENTS.md §23 "Still open"`.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **191 passed**
(users: 6 api, audit: 5 api new). No migration.
**Open / next:** deferred child tables, notification wiring, RLS enforcement test suite.

---

## 2026-08-28 — FR-15 Notifications module (backend module build-out COMPLETE)

**By:** backend module build-out, module 14 of the plan — **final FR module**
**Branch / commit:** `main`
**What changed:**
- **`notifications` module** end to end (filled the scaffold):
  - 4 tables — `notification_templates` (UQ `(community_id, code, channel)`, `{token}`
    rendering), `notifications` (per-user inbox), `notification_deliveries` (append-only,
    one row per channel), `user_notification_preferences` (UQ `(user, community, channel)`,
    quiet hours with midnight wrap; community row overrides account-wide `NULL` row).
  - `service.py` — `dispatch()` renders from a template or explicit content
    (`422 CONTENT_REQUIRED`), fans out per channel: `in_app` always delivered, others
    **simulated** delivered unless the channel is disabled / in quiet hours → `skipped`.
    Inbox is strictly the caller's own; `mark_read` / `mark_all_read`.
  - `router.py` — `notifications:{view,create}`; static routes before `/{notification_id}`.
  - migration `0017` — 4 tables + RLS on `notification_templates` / `notifications`.
  - RBAC: **`notifications:view` granted to all 10 roles**; `notifications:create` to admins.
  - `seed_notifications()` — 3 templates per community.
  - docs: `docs/backend/modules/notifications/README.md`, `docs/backend/api/notifications.md`.
**Why:** FR-15.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **180 passed**
(notifications: 5 unit + 5 api new); `alembic downgrade 0016_incidents && alembic upgrade head`
round-trip; reseed.
**Open / next:** All 15 FR modules are implemented (FR-01…FR-15 + audit/RBAC foundation).
Remaining is integration/polish — see `AGENTS.md §23 "Still open"` and
`backend-handover-document.md`: RLS enforcement test suite, notification wiring into the
domain modules, audit read API (FR-16), user/role management endpoints (FR-02), and the
deferred child tables. Migrations `0001`–`0017`. **Not yet pushed** — awaiting the owner's word.

---

## 2026-08-28 — FR-14 Dashboards module

**By:** backend module build-out, module 13 of the plan
**Branch / commit:** `main`
**What changed:**
- **`dashboards` module** — **no tables**, no migration. `service.py` runs scoped
  `COUNT`/`SUM` queries across every other module; **every query filtered by the viewer's
  community before aggregation** (AGENTS.md §14). 4 views:
  - `overview` — community KPIs (residents, units, pending visitor reqs, visitors inside,
    pending deliveries, open tickets/incidents, active panic alerts, outstanding balance).
  - `security` — visitors/vehicles/staff inside, pending approvals, panic alerts, open
    incidents, guards on active roster.
  - `financial` — invoices by status, total billed / collected, outstanding.
  - `resident` — scoped to the caller's occupancy: my open tickets / visitor reqs / upcoming
    bookings / dues, published announcements.
  - `router.py` — `dashboards:view`; optional `?community_id=` for a global caller.
  - RBAC: `resident` + `security_guard` gained `dashboards:view`.
  - docs: `docs/backend/modules/dashboards/README.md`, `docs/backend/api/dashboards.md`.
**Why:** FR-14.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **170 passed**
(dashboards: 7 api new). No migration → no round-trip.
**Open / next:** FR-15 `notifications` module (last).

---

## 2026-08-28 — FR-13 Emergency & Incident Management module

**By:** backend module build-out, module 12 of the plan
**Branch / commit:** `main`
**What changed:**
- **`incidents` module** end to end (filled the scaffold):
  - 4 tables — `security_incidents` (optional `panic_alert_id → panic_alerts`,
    tower/unit/gate refs, UQ `(community_id, incident_number)`), append-only
    `incident_status_history` + `incident_actions`, `incident_assignments`.
  - `service.py` — `INC-<year>-<seq>` numbering; response lifecycle
    `reported→acknowledged→responding→{contained,resolved}→closed` (+ `false_alarm`);
    **resolve requires `resolution_summary`**; closed/false_alarm are terminal;
    one active assignment per `(incident, user)`; append-only action + history logs.
  - `router.py` — `incidents:{view,create,update}`; `/assignments/{id}/release` static prefix.
  - migration `0016` — 4 tables + RLS on `security_incidents` / `incident_status_history`.
  - RBAC: `resident` gained `incidents:{view,create}` (self-report / SOS).
  - `seed_incidents()` — one resolved sample incident per community.
  - docs: `docs/backend/modules/incidents/README.md`, `docs/backend/api/incidents.md`.
**Why:** FR-13; consumes FR-05 panic alerts.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **163 passed**
(incidents: 5 unit + 5 api new); `alembic downgrade 0015_communication && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-14 `dashboards` module. `incident_attachments` deferred.

---

## 2026-08-28 — FR-12 Communication & Broadcasts module

**By:** backend module build-out, module 11 of the plan
**Branch / commit:** `main`
**What changed:**
- **`communication` module** end to end (filled the scaffold):
  - 6 tables — `announcements` (+ `announcement_targets` with a valid-combination CHECK),
    `polls` (1:1 with announcement) + `poll_options` + `poll_responses`
    (UQ `(poll_id, user_id)`) + `poll_response_options`.
  - `service.py` — announcement editable only while unpublished; **publish freezes** it and
    requires ≥ 1 target; poll status machine `draft→open→closed` where opening needs a
    published announcement; voting enforces open window, option membership, single-vs-multi
    choice, one response per user; live `tally()` for results.
  - `router.py` — `communication:{view,create,update,approve}`; voting gated on `:view`.
  - migration `0015` — 6 tables + RLS on `announcements` / `polls`.
  - RBAC: `resident` gained `communication:view`; `association_committee` gained
    `communication:{view,create,update,approve}`.
  - `seed_communication()` — one published all-community welcome notice per community.
  - docs: `docs/backend/modules/communication/README.md`, `docs/backend/api/communication.md`.
**Why:** FR-12.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **153 passed**
(communication: 6 unit + 4 api new); `alembic downgrade 0014_amenities && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-13 `incidents` module. `resident_groups` deferred.

---

## 2026-08-28 — FR-11 Amenity Booking module

**By:** backend module build-out, module 10 of the plan
**Branch / commit:** `main`
**What changed:**
- **`amenities` module** end to end (filled the scaffold):
  - 5 tables — `amenities`, `amenity_slots` (weekly availability), `amenity_rules`
    (config-as-data, `{"value": N}` JSONB), `amenity_blocks` (maintenance windows),
    `amenity_bookings` (composite tenant-safe FKs to amenities + units).
  - `service.py` — slot/weekday validation; booker's unit from active occupancy;
    rule engine (`max_advance_days`, `max_hours_per_booking`, `max_active_per_unit`,
    `min_cancel_hours`); **atomic conflict check** = `SELECT … FOR UPDATE` on the amenity,
    then maintenance-block overlap, then capacity across overlapping confirmed bookings.
  - `router.py` — `amenities:{view,create,update,approve}`; `/bookings/*` before `/{amenity_id}`.
  - migration `0014` — 5 tables + RLS on all five.
  - `seed_amenities()` — CLUB + GYM per community with per-weekday slots + 2 rules;
    `seed_residents()` now links `resident@gatesphere.com` to a unit (7th, to avoid the
    residents-module tests' last-unit) so bookings work out of the box.
  - docs: `docs/backend/modules/amenities/README.md`, `docs/backend/api/amenities.md`.
**Why:** FR-11.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **143 passed**
(amenities: 6 unit + 5 api new); full `alembic downgrade base && upgrade head` + reseed +
`alembic downgrade 0013_complaints && upgrade head` round-trip.
**Open / next:** FR-12 `communication` module.

---

## 2026-08-28 — FR-10 Complaint & Service Desk module

**By:** backend module build-out, module 9 of the plan
**Branch / commit:** `main`
**What changed:**
- **`complaints` module** end to end (filled the scaffold):
  - 7 tables — `service_categories`, `sla_policies` (config-as-data, composite tenant-safe FK
    to categories), `service_tickets` (composite tenant-safe FKs to units + categories,
    `RESTRICT` on category delete, SLA clock columns), `ticket_status_history` (append-only),
    `ticket_assignments` (executor XOR CHECK), `ticket_messages`, `ticket_feedback` (1 per ticket).
  - `service.py` — SLA due-dates stamped from the `(category, priority)` policy at creation;
    lifecycle `created→assigned→acknowledged→in_progress→resolved→resident_confirmation`;
    `closed`/`reopened` reachable **only** through `confirm_ticket` (no close without resident
    confirmation); first-response + resolution SLA-breach stamping; one active assignment.
  - `router.py` — `complaints:{view,create,update,approve}`; `/categories` + `/sla` before
    `/tickets/*`.
  - migration `0013` — 7 tables + RLS on the 3 tenant tables.
  - `seed_complaints()` — 4 categories + matching SLA policies per community.
  - docs: `docs/backend/modules/complaints/README.md`, `docs/backend/api/complaints.md`.
**Why:** FR-10.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **131 passed**
(complaints: 5 unit + 5 api new); `alembic downgrade 0012_billing && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-11 `amenities` module. `ticket_attachments` deferred.

---

## 2026-08-28 — FR-09 Maintenance & Billing module

**By:** backend module build-out, module 8 of the plan
**Branch / commit:** `main`
**What changed:**
- **`billing` module** end to end (filled the scaffold):
  - 7 tables — `charge_heads`, `billing_rules` (config-as-data), `maintenance_invoices`
    (composite tenant-safe FK to units) + `invoice_items`, `payments` (simulated) +
    `payment_allocations`, `ledger_entries` (append-only, Postgres `Identity` `entry_seq`
    for a monotonic running balance).
  - `service.py` — server-computed totals (`subtotal`, `tax` from `rule.tax_percent`, `total`,
    `balance_due`), all quantised to 2 dp; `draft→posted` freeze writes a ledger debit;
    simulated payment requires allocations to sum exactly to `amount`, never exceed an
    invoice balance, and advances `posted→partially_paid→paid` with a ledger credit per
    allocation; cancel refused when `amount_paid > 0`.
  - Also hardened `audit.service._jsonable` to handle `Decimal` / `datetime` / `date`.
  - `router.py` — `billing:{view,create,approve,export}`; static routes before `/invoices/*`.
  - migration `0012` — 7 tables + `entry_seq` Identity + RLS on the 5 tenant tables.
  - RBAC: `resident` + `association_committee` gained `billing:create`;
    `association_committee` also `billing:approve`.
  - `seed_billing()` — rules (18% tax) + 3 charge heads per community.
  - docs: `docs/backend/modules/billing/README.md`, `docs/backend/api/billing.md`.
**Why:** FR-09.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **121 passed**
(billing: 5 unit + 5 api new); `alembic downgrade 0011_vehicles && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-10 `complaints` (paused here at the user's request — see
`backend-handover-document.md`).

---

## 2026-08-28 — FR-08 Vehicle & Parking module

**By:** backend module build-out, module 7 of the plan
**Branch / commit:** `main`
**What changed:**
- **`vehicles` module** end to end (filled the scaffold):
  - 6 tables — `vehicles` (owner **XOR** DB CHECK, plate upper-cased, UQ `(community_id, plate)`),
    `parking_rules` (config-as-data), `parking_slots`, `parking_allocations` (composite
    tenant-safe FKs, partial-unique active per slot + per vehicle), `vehicle_entries`
    (plate log, `is_flagged` for unknown plates), `parking_violations`.
  - `service.py` — owner XOR (schema + DB); one active allocation per slot/vehicle;
    `max_active_slots_per_unit` cap from `parking_rules`; unknown-plate entries flagged;
    violation state machine. `record_audit` on every write.
  - `router.py` — `/vehicles`, `vehicles:{view,create,update,approve}`; `/parking/*` +
    `/entries/*` before `/{vehicle_id}`.
  - migration `0011` — 6 tables + partial-unique indexes + RLS on all six.
  - RBAC: `security_guard` / `security_supervisor` gained `vehicles:create` (plate entry).
  - `seed_vehicles()` — rules + 5 slots + 1 resident car per community.
  - docs: `docs/backend/modules/vehicles/README.md`, `docs/backend/api/vehicles.md`.
**Why:** FR-08.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **111 passed**
(vehicles: 5 unit + 6 api new); `alembic downgrade 0010_deliveries && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-09 `billing` module.

---

## 2026-08-28 — FR-07 Delivery Management module

**By:** backend module build-out, module 6 of the plan
**Branch / commit:** `main`
**What changed:**
- **`deliveries` module** end to end (filled the scaffold):
  - 3 tables — `delivery_protocols` (config-as-data, UQ `(community_id, delivery_type)`),
    `deliveries` (composite tenant-safe FKs to units + protocols), `delivery_events`
    (append-only timeline).
  - `service.py` — protocol auto-created with safe default if missing; auto-approve when
    `allow_direct_entry AND NOT requires_otp`; decision only on pending; arrival gated on
    approval; `mark_delivered` picks `delivered` vs `collected` from `protocol.leave_at_gate`.
    Every step emits a `delivery_events` row + `record_audit`.
  - `router.py` — `deliveries:{view,create,update,approve}`; `/protocols` PUT upsert.
  - migration `0010` — 3 tables + RLS on the 2 tenant tables.
  - RBAC: `resident` gained `deliveries:{view,create,approve}` (approve own deliveries);
    `security_supervisor` gained `deliveries:{create,update}`.
  - `seed_deliveries()` — 3 protocol presets per community.
  - docs: `docs/backend/modules/deliveries/README.md`, `docs/backend/api/deliveries.md`.
**Why:** FR-07.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **100 passed**
(deliveries: 5 unit + 5 api new); `alembic downgrade 0009_domestic_staff && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-08 `vehicles` module.

---

## 2026-08-28 — FR-06 Domestic Staff module

**By:** backend module build-out, module 5 of the plan
**Branch / commit:** `main`
**What changed:**
- **`domestic_staff` module** end to end (filled the scaffold):
  - 4 tenant tables — `domestic_staff` (UQ `(community_id, phone)`, HMAC `id_number_hash`),
    `staff_unit_assignments` (partial-unique active `(staff, unit)`, `CHECK start<=end`),
    `staff_attendance` (partial-unique open row per staff, `CHECK check_out>=check_in`),
    `staff_ratings` (UQ `(staff, unit, resident)`, `CHECK rating 1..5`). Composite tenant-safe
    FKs to `units` + `domestic_staff`.
  - `service.py` — upsert-by-phone guard; one active assignment per `(staff,unit)`;
    single open attendance row; rating upsert per resident. `record_audit` on every write.
  - `router.py` — prefix `/domestic-staff` (hyphen); `domestic_staff:{view,create,update,approve}`;
    static routes before `/{staff_id}`.
  - migration `0009` — 4 tables + partial-unique indexes + RLS.
  - RBAC: `security_guard` / `security_supervisor` gained `domestic_staff:create`+`:update`
    (gate attendance); `resident` gained `domestic_staff:view`+`:create` (onboard + rate).
  - `seed_domestic_staff()` — 3 staff + 1 assignment per community.
  - docs: `docs/backend/modules/domestic_staff/README.md`, `docs/backend/api/domestic-staff.md`.
**Why:** FR-06.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **90 passed**
(domestic_staff: 6 unit + 6 api new); `alembic downgrade 0008_gate && alembic upgrade head`
round-trip; reseed.
**Open / next:** FR-07 `deliveries` module.

---

## 2026-08-28 — FR-05 Gate / Security Operations module

**By:** backend module build-out, module 4 of the plan
**Branch / commit:** `main`
**What changed:**
- **`gate` module** end to end (filled the pre-existing scaffold):
  - 4 tenant tables — `gate_events` (**append-only**, `(community_id, gate_id, occurred_at)`
    index, JSONB `metadata` mapped as `event_metadata`), `guard_rosters`
    (UQ `(community_id, guard, shift_date, shift_start)`), `gate_assignments`,
    `panic_alerts`.
  - `service.py` — community derived from the referenced gate or a single-community scope;
    events are insert-only; roster machine `planned→active→completed` / `→cancelled`;
    one `active` assignment per guard (`409 ASSIGNMENT_ACTIVE`); panic machine
    `active→acknowledged→resolved`, `cancel` only by the raiser (`403 NOT_ALERT_OWNER`).
    `record_audit` on every write.
  - `router.py` — `gate:{view,create,update}`; **raising** a panic alert needs only a session
    (residents can SOS), **cancelling** is restricted to the raiser in the service.
  - migration `0008` — 4 tables + RLS.
  - `seed_gate()` — active roster + assignment + `gate_open` event per community.
  - docs: `docs/backend/modules/gate/README.md`, `docs/backend/api/gate.md`.
**Why:** FR-05; shared event log that visitor/delivery/staff/vehicle flows will write into.
**Verified:** `ruff check` + `black --check` clean; `pytest -q` → **78 passed**
(gate: 9 unit + 6 api new); `alembic downgrade 0007_visitors && alembic upgrade head` round-trip; reseed.
**Open / next:** FR-06 `domestic_staff` module.

---

## 2026-08-28 — FR-04 Visitor Management module

**By:** backend module build-out, module 3 of the plan
**Branch / commit:** `main`
**What changed:**
- **`visitors` module** end to end, following the `communities` shape:
  - 7 tables — `visitors` (UQ `(community_id, phone)`, `id_number_hash` HMAC only),
    `visitor_blacklist` (`phone_hash` / `id_number_hash` HMAC, indexed), `visitor_policies`
    (one per community, auto-created), `visitor_requests` (composite tenant-safe FKs to
    `visitors` + `units`), `visitor_approvals` (UQ `(request_id, approver_user_id)`),
    `visitor_passes` (`token_hash` HMAC, shown once), `visitor_entries` (`inside/exited/denied`).
  - `service.py` — blacklist screening at request time **and** re-check at the gate
    (`blacklist_mode="block"` → `403 VISITOR_BLACKLISTED`, denied entry row recorded);
    `recurring` visitor type skips approval; host = unit's primary active occupant;
    decision only on `pending` (one per approver → `409 ALREADY_DECIDED`); pass issuance
    pre-approves a pending request, `valid_to` defaults to `now + pass_ttl_minutes`;
    gate entry gated on `PASS_REVOKED/EXPIRED/EXHAUSTED` + `NOT_APPROVED` + `ALREADY_INSIDE`,
    bumps `visit_count` / `frequent_visitor_flag` (≥5); exit → `NOT_INSIDE` guard, completes
    the request. `record_audit` on every write.
  - `router.py` — static-prefix routes before the `GET ""` directory list; `visitors:approve`
    on the decision route so a resident host can approve.
  - migration `0007` — the 7 tables + RLS on the 5 tenant tables; also renames the `audit_logs`
    indexes orphaned by `0005`'s column rename.
  - RBAC: `security_supervisor` / `security_guard` gained the visitor permissions they need
    (blacklist view, entry/exit, request create/update).
  - `seed_visitors()` — a policy per community + 3 sample visitors.
  - docs: `docs/backend/modules/visitors/README.md`, `docs/backend/api/visitors.md`.
**Why:** FR-04; the security-desk core of the product.
**Verified:** `ruff check` + `black --check` clean (200 files); `pytest -q` → **64 passed**
(8 unit + 6 api new); `alembic downgrade 0006_residents && alembic upgrade head` round-trip; seed re-run.
**Open / next:** FR-05 `gate` module.

---

## 2026-08-28 — FR-03 Residents module

**By:** backend module build-out, module 2 of the plan
**Branch / commit:** `main`
**What changed:**
- **`residents` module** end to end, following the `communities` shape:
  - 5 tenant tables (`resident_profiles`, `unit_occupancies`, `family_members`,
    `emergency_contacts`, `move_records`) with **composite tenant-safe FKs** to `units` and
    `resident_profiles`; **partial unique index** `uq_unit_primary_active` = one primary active
    occupant per unit.
  - `service.py` — active-community resolution (single-community scope, or `?community_id=` for
    global; else `COMMUNITY_REQUIRED`); cross-tenant user/unit/profile → 404; one profile per
    `(community,user)`; occupancy conflict + primary-occupant conflict; occupancy end-date > start;
    **move-record state machine** (`_MOVE_TRANSITIONS`) — `requested→scheduled→approved→completed`
    / `→rejected` / `→cancelled`, invalid → `422 INVALID_TRANSITION`; `approve` stamps approver;
    a completed `move_out` deactivates the occupancy. `record_audit` on every write.
  - `router.py` — static-prefix routes (`/move-records`, `/occupancies`, `/units/...`,
    `/emergency-contacts/...`, `/family-members`) declared **before** the `/{profile_id}`
    catch-all so `GET /residents/move-records` isn't parsed as a profile id (regression test).
  - migration `0006` — the 5 tables + `UQ(id, community_id)` on `units` + RLS on all five.
  - `seed.py` — `seed_residents()`: 6 profiles + primary occupancies + 1 emergency contact each,
    per community.
- Tests: `test_residents_unit.py` (9 service-rule cases incl. move state machine + occupancy
  deactivation) + `test_residents_api.py` (6 integration incl. 401, resident-role 403, the
  move-records route-order regression, full CA flow with `try/finally` cleanup, cross-community
  404). **50 tests total**, run twice for idempotence.
**Verified:** `ruff` + `black --check` clean; `pytest -q` 50 pass (x2); migration
`downgrade→base→head` x2 clean; live curl — list profiles (6), `/move-records` resolves (200),
emergency-contacts list.
**Open / next:** FR-04 **visitors** (visitors, visitor_blacklist, visitor_groups,
visitor_requests, visitor_approvals, visitor_passes, visitor_entries, visitor_policies) — the
first module with a real approval workflow + QR/OTP passes.

---

## 2026-08-27 — FR-03 Community & Property module (reference implementation)

**By:** backend module build-out, module 1 of the plan
**Branch / commit:** `main`
**What changed:**
- **`communities` module implemented end to end** as the reference for every subsequent module:
  - `models.py` — `Community` (tenant root, not scoped), `Gate`/`Tower`/`Floor`/`Unit` (TenantMixin
    + **composite tenant-safe FKs**: `floors(tower_id,community_id)→towers`,
    `units(floor_id,community_id,tower_id)→floors`). Enum tuples for gate/structure/unit type.
  - `schemas.py` — `*Create/*Update/*Read` per entity, all `extra="forbid"`, code pattern + range validators.
  - `repository.py` — `CommunityRepository` (scoped on `id`, since communities has no `community_id`)
    + `Gate/Tower/Floor/Unit` repos on `TenantRepository`.
  - `service.py` — `CommunityService`: community create/delete = global-scope only; child entities
    created in the caller's active community (from `TenantScope.require()`, never the payload);
    `floor.tower` / `unit.floor` resolved within scope (cross-tenant → 404); enum → 422
    `INVALID_ENUM`; duplicates → 409 with stable codes; every write calls `record_audit()`.
  - `deps.py` / `router.py` — thin endpoints, canonical envelope, `require_permission("communities:*")`,
    `tenant_context`. `/communities`, `/{id}`, `/{id}/{gates,towers}`, `/towers/{id}[/floors]`,
    `/floors[/{id}/units]`, `/units[/{id}]`.
- **`audit` module** — `AuditLog` reshaped to the AGENTS §10 column names (`created_at`, `user_id`,
  `session_id` uuid, `old_values`, `new_values`, `ip_address` inet, `user_agent`) via migration
  `0005`; new `audit/service.py::record_audit()` (called inside the operation's transaction).
- **Migrations** `0004` (reshape towers/floors/units to ERD + add gates + RLS on all four) and
  `0005` (audit shape). Full `downgrade→base→head` round-trip verified twice.
- **seed.py** — Green Park Enclave / Sunrise Heights, 2 gates + 2 towers + 2 floors + 7 units each
  (56 units), new column names.
- **conftest.py** — `as_role(slug)` factory, `seed_ids`, `unique_code` fixtures; session-scoped
  autouse fixture disables the login rate limiter for tests.
- **Tests** — `test_communities_unit.py` (7 service-rule tests: global-only, conflict, bad enum,
  cross-tenant 404, inheritance, audit-row) + `test_communities_api.py` (6 integration: full
  hierarchy, 401, resident 403, community-admin scoping + 404-not-403, auditor read-only,
  extra-field 422). 35 tests total, all green.
- Docs: `docs/backend/modules/communities/README.md` + `docs/backend/api/communities.md` filled
  in; AGENTS.md §23 gains the module build-out status table.
**Why:** FR-03 is the master-data spine every other module references; doing it first + fully
establishes the pattern.
**Verified:** `ruff` + `black --check` clean; `pytest -q` 35 pass; migration round-trip x2;
live curl — list communities (envelope + meta), list gates, create tower (201 + envelope).
**Open / next:** FR-03 **residents** (resident_profiles, unit_occupancies, family_members,
emergency_contacts, move_records), then FR-04 visitors. Each: add its tenant tables to a new RLS
migration; extend seed; unit + integration tests.

---

## 2026-08-27 — Foundation upgrade: identity, sessions, envelope, tenancy, RLS, frontend structure

**By:** foundation upgrade pass (per AGENTS.md §23)
**Branch / commit:** `main` (foundation commits)
**What changed:**
- **Identity:** UUID v4 repo-wide — [ADR-009](../decisions/ADR-009-identifiers.md). `base_class.py`
  gains `pk()` / `fk()` / `TenantMixin` (+ `uuid_pk` alias). User asked to standardise on UUID
  rather than switch to the ERD's BIGINT.
- **Sessions:** `user_sessions` table is now the system of record (migration `0002`).
  `app/core/security.py` writes through + caches in Redis; `_load_session` re-checks
  `revoked_at`/`expires_at` on a cache miss; `revoke_all_user_sessions()` for password/role change;
  logout revokes the row (verified: `me` after logout → 401 "Session revoked").
- **Response envelope:** `{ success, message, data, meta }` everywhere; errors
  `{ success:false, message, data:null, error:{code,fields} }`. New `app/core/responses.py`
  (`ok`, `paginated`, `Response[T]`, `PageResponse[T]`, `page_params`) and `app/core/errors.py`
  (`AppError` hierarchy + central handlers for AppError / RequestValidationError / HTTPException /
  SQLAlchemyError→409-on-stale / catch-all). Auth router + `/`, `/healthz`, `/readyz`, and the 17
  module `/health` stubs all wrapped. Rate-limit handler emits the envelope too.
- **Tenancy infra:** `app/core/tenancy.py` — `TenantScope`, `get_tenant_scope` (resolves from
  `user_roles`, honours `X-Community-Id` for Super Admin, cross-tenant → 404), `tenant_context`
  combined dep, `bind_rls_scope` (sets the `app.community_ids` GUC). `app/db/repository.py` —
  `Repository` + `TenantRepository` (scope predicate injected on every read, checked on write).
- **RLS:** migration `0003` — `ENABLE ROW LEVEL SECURITY` + a GUC-based `tenant_isolation` policy
  on `towers/floors/units/user_roles/audit_logs`. Permissive when the GUC is empty (bootstrap /
  local superuser) or `community_id IS NULL`.
- **Frontend structure:** `app/(public)/login`, `app/(protected)/{layout,dashboard}`,
  `app/unauthorized`. New `lib/api.ts` (envelope unwrap + `ApiError{status,code,fields}`),
  `lib/query.ts` (`makeQueryClient`, `clearQueryCache`), `lib/permissions.ts` (`can`),
  `store/ui.ts` (Zustand), `hooks/use-auth.ts` (`useMe/useLogin/useLogout` — `queryClient.clear()`
  on every identity change), `providers.tsx` (global 401 → `/login`). Login form is RHF + Zod,
  maps `error.fields` back onto the form. Deps added: zustand, react-hook-form, zod,
  @hookform/resolvers. `package-lock.json` committed. `.prettierignore` added.
**Why:** these are the breaking-to-change-later pieces of the foundation — API shape, identity
type, session model, tenant-scope plumbing, and the frontend data/auth wiring.
**Verified:** `docker compose` stack healthy. Backend: `ruff` + `black --check` clean, `pytest`
22 pass (incl. new `test_auth_session.py`), migration downgrade→re-upgrade round-trip OK, live
curl of login/me/logout/validation/module-health all in the envelope. Frontend: `npm run
typecheck` + `lint` clean, `npx prettier --check` clean, `npm run build` succeeds; routes +
middleware redirect + `/api` proxy verified.
**Open / next:** AGENTS.md §23 "Still open" — full module schema build-out (+ add each new tenant
table to a follow-up RLS migration), the restricted-role RLS test suite, OTP/community-switcher/
gate-feed features, the Tailwind+shadcn design system, permission-version caching.

---

## 2026-08-27 — Scaffold + engineering standards baseline

**By:** initial scaffold
**Branch / commit:** (pre-VCS) local scaffold in `GateSphere_Internal/`
**What changed:**
- Runnable local `docker compose` stack: Next.js + FastAPI + Postgres + Redis + MinIO + Celery
  (worker + beat). Auto-migrate + seed on backend start.
- Backend: `app/core` (config, security/session+CSRF, rbac catalogue, redis, logging, celery),
  `app/modules/*` (17 modules scaffolded — router/schemas/service/repository/models/tasks/tests),
  `app/db` (base, session), `app/services` (email→Brevo, storage→S3), Alembic + `0001_initial`
  (communities/towers/floors/units, users/roles/permissions/role_permissions/user_roles,
  audit_logs), `app/scripts/seed.py` (2 communities, 4 towers, 8 floors, 56 units, one demo user
  per role, per-role password `<role>@Gate2026!`).
- Frontend: App Router shell, `(public)` login, `(protected)` dashboard, `lib/api.ts` (same-origin
  proxy + CSRF), `middleware.ts` guard, TanStack Query provider.
- Docs tree: platform / backend modules + api / frontend modules / flows / database / security /
  ADRs. `AGENTS.md` + `backend/AGENTS.md` + `frontend/AGENTS.md`, `STARTER.md`, `Makefile`, CI
  (`.github/workflows/ci.yml` + SonarQube), `sonar-project.properties`, `.pre-commit-config.yaml`.
- Root `/` endpoint returns service metadata; `/healthz` (name+version+env), `/readyz` (DB+Redis).
**Why:** establish a runnable, standards-enforced starting point per the 13-day plan Phase 1–2.
**Verified:** `docker compose up` — all 7 services healthy; login / `/auth/me` / logout (CSRF)
work; RBAC permissions correct per role; frontend serves + proxies; `pytest` 18 passed;
`ruff` + `black --check` clean. (Ran on remapped host ports — this machine already uses
3000/5432/6379/8000/9000.)
**Open / next:** the 8 items in `AGENTS.md §23` — chiefly reconcile PK type (UUID→BIGINT per ERD
v1.2), add `user_sessions` table, migrate to the `{data,meta}`/`{error}` response envelope, build
out the remaining module tables from `docs/database/schema.md`, add RLS + its test suite.

## 2026-08-27 — AGENTS.md upgraded from source documents + peer project

**By:** standards pass
**What changed:** Rewrote `AGENTS.md` into a full engineering contract, distilled from the PRD /
SRS / TRD / DB ERD v1.2 / Wireframes / Plan of Action, and incorporating transferable engineering
disciplines from a peer project's AGENTS.md (priority order for fixes, schema `extra="forbid"`
mass-assignment guard, pagination/never-unbounded, central error handling, N+1 discipline, Redis
failure-tolerance, job idempotency-by-stamping + narrow retry allow-list, frontend
`queryClient.clear()` on identity change + ref-guarded mutations + bulk partial-failure + upload
state machine + three-distinct-UX-states, RLS test blind spot, OWASP Top 10 control table, feature
lifecycle, four-section done report, session continuity). Added
[`docs/database/schema.md`](../database/schema.md) (full ERD v1.2 table catalogue) and
[`docs/platform/api-contract.md`](../platform/api-contract.md) (response envelope + status map).
`backend/AGENTS.md` and `frontend/AGENTS.md` updated to match.
**Verified:** documentation only — no code change.
**Open / next:** as above (§23).

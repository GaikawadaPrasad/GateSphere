# GateSphere — Workflow State Machines

Every lifecycle in the backend, its transition table, where it is enforced, and the
side-effects (audit + notification) each transition fires. Derived from
`app/modules/*/service.py` + `app/core/state_machine.py::ensure_transition`.

**Enforcement layers**
- **App:** service methods — either `ensure_transition(current, target, MAP)` (shared gate) or
  an explicit `if status not in {...}: raise BusinessRuleError(code="INVALID_TRANSITION")`.
- **DB:** `CHECK (col IN (...))` constraint pins the *value set* (migration `0025`) — an
  impossible state cannot be persisted even by a bug. It does **not** encode the transition
  graph; that stays in the service.
- Cross-tenant reads of any of these return **404** (repository `_scoped()`), so an invalid
  transition attempt on another community's record is a 404, not a 409.

Legend: `▸` terminal state. Every `→` also writes an `audit_logs` row in the same
transaction; 🔔 = emits a notification event.

---

## 1. Visitor Request — `visitor_requests.status`  (`app/modules/visitors/service.py`)

| From | To | Trigger | Notes |
|---|---|---|---|
| `pending` | `approved` | `decide_request(decision=approved)` — `visitors:approve` | one approval row per approver; 🔔 requester |
| `pending` | `rejected` ▸ | `decide_request(decision=rejected)` | 🔔 requester |
| `pending` | `approved` | `create_pass` when `approval_required` — "a valid pass pre-approves" | **SM-1 (MEDIUM):** gated only by `visitors:create`, not `visitors:approve`, and does not check the actor owns the unit |
| `pending` / `approved` | `cancelled` ▸ | `cancel_request` | requester/creator |
| `pending` | `expired` ▸ | Celery `expire_stale_requests` (15 min) — `valid_until` passed | 🔔 |
| `approved` | `entered` | `record_entry` — pass verified at gate (`visitors:update`) | creates `visitor_entries` row `inside` |
| `entered` | `completed` ▸ | `record_exit` when no `visitor_entries` row is still `inside` | |

Blocked / rejected paths: blacklisted visitor → `record_entry` raises `BLACKLISTED` (no state
change); invalid/expired/revoked/exhausted pass → `PASS_*` errors; adding a member or issuing a
pass on `rejected|cancelled|expired|completed` → `INVALID_STATE`.

### Visitor Entry — `visitor_entries.status` : `inside → exited`; `denied` ▸ (set directly by a failed gate check). CHECK-pinned.
### Visitor Pass — `is_revoked` boolean + `valid_from/valid_to` window + `entry_count/max_entries`. `revoke_pass` sets `is_revoked` (one-way). Not a status enum.

---

## 2. Complaint / Service Ticket — `service_tickets.status`  (`_TICKET_ACTIONS`, `_TRANSITIONS`)

| From | To |
|---|---|
| `created` | `assigned`, `cancelled` ▸ |
| `assigned` | `acknowledged`, `in_progress`, `cancelled` ▸ |
| `acknowledged` | `in_progress`, `cancelled` ▸ |
| `in_progress` | `resolved` (→ auto-advances to `resident_confirmation`), `cancelled` ▸ |
| `resolved` | `resident_confirmation` (automatic) |
| `resident_confirmation` | `closed` ▸ (resident confirms), `reopened` (resident disputes) |
| `reopened` | `assigned`, `in_progress`, `cancelled` ▸ |
| `closed` ▸, `cancelled` ▸ | — |

- `transition_ticket` uses `_TICKET_ACTIONS` (client-driven moves); `resolved` request is
  rewritten to land on `resident_confirmation` with `resident_confirmation_status=pending`.
- `assign_ticket`, `confirm_ticket`, `add_feedback` are separate endpoints, not `transition`.
- 🔔 the ticket raiser on every transition.
- **SLA sub-machine** — `service_tickets.escalation_state`: `on_track → at_risk → breached →
  escalated` (monotonic, Celery `sweep_ticket_sla` every 5 min against `response_due_at` /
  `resolution_due_at`). 🔔 assignee + `security_supervisor` on `escalated`. CHECK-pinned.
- `resident_confirmation_status`: `pending → confirmed | disputed`. CHECK-pinned.

---

## 3. Delivery — `deliveries.status` + `deliveries.approval_status`  (`app/modules/deliveries/service.py`)

`approval_status`: `pending → approved | auto_approved | rejected` (`decide_delivery`; the
protocol may `auto_approved` at creation). Rejecting sets `status=cancelled`.

`status`:

| From | To | Trigger |
|---|---|---|
| `expected` | `at_gate` | `record_arrival` (needs `approval_status ∈ {approved, auto_approved}`) |
| `expected`, `at_gate`, `in_transit` | `delivered` \| `collected` | `mark_delivered` — `collected` if the protocol is `leave_at_gate`, else `delivered` |
| `expected`, `at_gate` (not delivered/collected/returned/cancelled) | `cancelled` ▸ | `cancel_delivery` |
| `delivered` ▸, `collected` ▸, `returned` ▸, `cancelled` ▸ | — | |

Protocol routing (`delivery_protocols`): `verify_at_gate` / `resident_approval` /
`leave_at_gate` / `reject` decide whether `decide_delivery` is needed and the terminal state.
🔔 resident on create (approval needed) and on decision.

---

## 4. Amenity Booking — `amenity_bookings.status`  (`app/modules/amenities/service.py`)

| From | To | Trigger |
|---|---|---|
| — | `confirmed` | `book` — after the **locked** conflict check |
| `confirmed` | `cancelled` ▸ | `cancel_booking` (respects `min_cancel_hours` rule) |
| `confirmed` | `completed` ▸, `no_show` ▸ | `mark_booking` |

Rejected at `book` time (no row created): `AMENITY_BLOCKED` (maintenance block overlap),
`SLOT_FULL` (capacity across overlapping `confirmed`), `UNIT_BOOKING_LIMIT`, `TOO_FAR_AHEAD`,
`TOO_LONG`, `INVALID_TIME_RANGE`. Concurrency: `amenities.lock(id)` = `SELECT … FOR UPDATE`
before the capacity sum → two simultaneous bookings for the last seat cannot both win
(covered by `test_amenities_api.py`).

---

## 5. Security Incident — `security_incidents.status`  (`_TRANSITIONS`)

| From | To |
|---|---|
| `reported` | `acknowledged`, `false_alarm` ▸ |
| `acknowledged` | `responding`, `false_alarm` ▸ |
| `responding` | `contained`, `resolved`, `false_alarm` ▸ |
| `contained` | `resolved`, `responding` |
| `resolved` | `closed` ▸, `responding` (re-open) |
| `closed` ▸, `false_alarm` ▸ | — |

`resolved` requires a `resolution_summary` (`SUMMARY_REQUIRED`). `assign` / `release` /
`add_action` are separate; `assign` is blocked once `closed|false_alarm`. Severity
(`critical|high|medium|low`) is set at creation, not a state machine. 🔔 reporter each move.

---

## 6. Billing — `maintenance_invoices.status` + `payments.payment_status`

Invoice:

| From | To | Trigger |
|---|---|---|
| — | `draft` | `create_invoice` (`total = subtotal − discount + tax + late_fee`, `balance_due = total`) |
| `draft` | `posted` | `post_invoice` |
| `posted`, `partially_paid`, `overdue` | `partially_paid` \| `paid` ▸ | `record_payment` (`paid` when `balance_due ≤ 0`) |
| `posted`, `partially_paid` | `overdue` | Celery `sweep_overdue_invoices` (01:00) — `due_date` passed |
| `draft`, `posted`, `overdue` | `cancelled` ▸ | `cancel_invoice` — blocked if `amount_paid > 0` |

Payments are **simulated** (PRD) → `record_payment` always writes `payment_status=success`
with a per-community `receipt_number`. `failed` / `refunded` are CHECK-allowed but unused.
Ledger: every payment writes a `ledger_entries` row; `unit_ledger` re-derives the running
balance — invariants covered by `test_billing_api.py` / `test_billing_unit.py`.

---

## 7. Domestic Staff — `domestic_staff.police_verification_status`  (`_VERIFICATION_TRANSITIONS`)

`not_started → pending → verified | rejected`; `rejected → pending`; `verified → expired |
pending`; `expired → pending`. Set via `update_staff`. Assignment to a unit
(`staff_unit_assignments`) is a separate 1:N relation with `is_active`; a staff member may
hold **multiple active assignments** across units (`active_for_pair` only blocks a duplicate
staff+unit pair). Attendance (`staff_attendance.attendance_status`): `inside → left`;
`absent` set directly. `check_in` blocked if an `inside` row exists. All CHECK-pinned.

---

## 8. Gate — `guard_rosters.status` (`_ROSTER_TRANSITIONS`) + `gate_assignments.status`

Roster: `planned → active | cancelled ▸`; `active → completed ▸ | cancelled ▸`.
Gate assignment: `active → ended` (`end_assignment`); one active assignment per guard
(`ASSIGNMENT_ACTIVE`). Panic alert (`panic_alerts.status`): `active → acknowledged →
resolved ▸`; `active → cancelled ▸` **only by the raiser** (`NOT_ALERT_OWNER`). All CHECK-pinned.

---

## 9. Vehicles / Parking

- `parking_violations.status` (`_VIOLATION_TRANSITIONS`): `open → acknowledged | resolved ▸ |
  waived ▸`; `acknowledged → resolved ▸ | waived ▸`.
- `parking_allocations.status`: `active → released` (`release`).
- `parking_slots.status`: `available | allocated | reserved | blocked` (managed by
  allocate/release + admin).
- `vehicle_entries.status`: `inside → exited` (`record_exit`).
All CHECK-pinned.

---

## 10. Residents

- `resident_profiles.profile_status` (`_PROFILE_TRANSITIONS`): `pending → active | suspended`;
  `active → suspended | moved_out`; `suspended → active | moved_out`; `moved_out → active`.
- `resident_profiles.kyc_status` (`_KYC_TRANSITIONS`): `not_started → submitted`; `submitted →
  verified | rejected`; `rejected → submitted`; `verified → submitted` (re-KYC).
- `move_records.status` (`_MOVE_TRANSITIONS`): `requested → scheduled | rejected ▸ | cancelled ▸`;
  `scheduled → approved | rejected ▸ | cancelled ▸`; `approved → completed ▸ | cancelled ▸`.
All CHECK-pinned.

---

## 11. Communication — `polls.status`: `draft → open → closed ▸` (`set_poll_status`). Voting requires `open` + within the poll window. Announcement: `is_published` boolean (publish is one-way and freezes the row) + `expire`. CHECK-pinned (polls).

---

## Findings

| ID | Sev | Finding |
|---|---|---|
| **SM-1** | MEDIUM | `create_pass` auto-approves a `pending` visitor request but is gated by `visitors:create` only (not `visitors:approve`) and does not verify the actor occupies the request's unit. A `visitors:create` holder who is not an approver can approve-by-proxy. *Fix:* require `visitors:approve` **or** actor-owns-unit before the `pending → approved` side-effect. |
| **SM-2** | LOW | Visitor request lifecycle is enforced by ad-hoc `if status …` checks across 6 methods rather than one `ensure_transition` map (unlike the other 6 modules). Correct today, but drift-prone. *Fix (deferred):* add `_REQUEST_TRANSITIONS` and route the checks through it. |
| **SM-3** | LOW | `payments.payment_status` only ever `success` (simulated). `failed`/`refunded` paths untested. Acceptable per PRD "payments simulated"; note for when a real gateway is wired. |
| **SM-4** | INFO (fixed) | 25+ status columns had **no** DB CHECK constraint → migration `0025` adds them. |

Tests: `backend/tests/test_state_machines.py` asserts a representative valid + invalid
transition per machine through the API; per-module `test_*_unit.py` cover the maps directly.

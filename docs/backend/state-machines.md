# Workflow state machines — audit & implementation report

> Every enum in the codebase, classified. Lifecycle enums have an explicit transition map in
> their service and a **dedicated action endpoint** (never a plain `PATCH … {status}`).
> The single gate is `app/core/state_machine.py::ensure_transition(current, target, MAP)` —
> it rejects unknown transitions, terminal-state transitions, and (by default) no-ops.

## 1. Enum classification

### A — Static / configuration (no transition logic; validated by `_enum` only)

| enum | where | values |
|---|---|---|
| `GATE_TYPES`, `STRUCTURE_TYPES`, `UNIT_TYPES` | communities | master data |
| `VISITOR_TYPES`, `PASS_TYPES`, `RISK_LEVELS` | visitors | |
| `EVENT_TYPES` | gate `gate_events` | **event type** (append-only, §C) |
| `STAFF_TYPES`, `WORK_TYPES` | domestic_staff | |
| `DELIVERY_TYPES`, `PROTOCOL_TYPES` | deliveries | protocol config, **not** lifecycle |
| `VEHICLE_TYPES`, `SLOT_TYPES`, `ENTRY_SOURCE`, `VIOLATION_TYPES` | vehicles | |
| `CALCULATION_TYPES`, `PAYMENT_METHODS`, `LATE_FEE_MODES` | billing | |
| `PRIORITIES` (complaints, communication) | | |
| `INCIDENT_TYPES`, `SEVERITIES`, `ACTION_TYPES` | incidents | |
| `AMENITY_TYPES`, `RULE_TYPES` | amenities | |
| `ANNOUNCEMENT_TYPES` | communication | |
| `CHANNELS` | notifications | |
| `ROLES`, `PERMISSIONS` | rbac | |
| upload `KINDS` | uploads catalogue | |

### C — Historical / event (append-only; NO update or delete path)

| table | field | enforcement |
|---|---|---|
| `gate_events` | `event_type` | service only inserts; no `update`/`delete` method |
| `visitor_entries` (denied rows) | `status='denied'` | inserted once at the gate |
| `delivery_events` | `event_type` | append-only timeline |
| `ticket_status_history`, `incident_status_history` | `from/to_status` | **never updated** |
| `audit_logs` | — | immutable; `REVOKE UPDATE/DELETE` in staging |
| `ledger_entries` | `entry_type` | append-only, `entry_seq` monotonic |
| `notification_deliveries` | `status` | one row per channel, written once |

### B — Lifecycle (explicit transition map + dedicated endpoint) — §2

---

## 2. Lifecycle state machines

Legend: **→** forward, **⇄** reversible/rework (justified by FR), **∎** terminal.
"Endpoint" is the only way to move the state (`PATCH …/{id}` never carries the status).

### 2.1 `visitor_requests.status`  (visitors)

`pending → approved → entered → completed` · `pending → rejected ∎` ·
`{pending,approved} → cancelled ∎` · `→ expired ∎` (time).

| transition | endpoint | role | data / invariant | history | notify (planned FR-15) |
|---|---|---|---|---|---|
| create → `pending` / `approved` | `POST /visitors/requests` | `visitors:create` | blacklist screen (block → 403); `recurring` type or policy = no approval | `visitor_approvals` on decision | host |
| `pending → approved/rejected` | `POST /visitors/requests/{id}/decision` | `visitors:approve` (resident host / supervisor) | one decision per approver (409) | ✓ | requester |
| `{pending,approved} → cancelled` | `POST /visitors/requests/{id}/cancel` | `visitors:update` | — | ✓ | — |
| `approved → entered` | `POST /visitors/entries` | `visitors:create` | pass not revoked/expired/exhausted; **not** blacklisted (re-check → denied entry + 403); no open entry | `visitor_entries` | — |
| `entered → completed` | `PATCH /visitors/entries/{id}/exit` | `visitors:update` | entry must be `inside` | — | — |

**Pass** (`visitor_passes`): `is_revoked` bool + `entry_count/max_entries` + `valid_from/to`.
A revoked / expired / exhausted pass **cannot** produce an entry (checked in `record_entry`).
Blocked jumps: `used/expired/revoked → active` — impossible (no code path sets those back).

### 2.2 `service_tickets.status`  (complaints) — the reference machine

`created → assigned → acknowledged → in_progress → resolved → resident_confirmation → closed`
· any pre-resolved → `cancelled ∎` · `resident_confirmation ⇄ reopened` (dispute) ·
`reopened → {assigned, in_progress}`.

- **`closed` / `reopened` are unreachable through `POST /tickets/{id}/transition`** — the
  endpoint drives `created..resolved + cancel` only (`_TICKET_ACTIONS`). They happen **only**
  via `POST /tickets/{id}/confirm` — **a ticket never closes without resident confirmation.**
- `resolved` is requested; the service moves the ticket to `resident_confirmation` and writes
  two history rows.
- data: assign needs internal-user XOR vendor (schema + no DB dup); resolve stamps
  `resolved_at` + SLA-breach; first-response stamping on assign / ack / in_progress / first
  non-internal staff message.
- feedback only when `status = closed`, once (`ticket_feedback` UQ).

### 2.3 `security_incidents.status`  (incidents)

`reported → acknowledged → responding → {contained, resolved}` · `contained ⇄ responding` ·
`resolved ⇄ responding` · `resolved → closed ∎` · early states `→ false_alarm ∎`.

- `transition_incident` → `ensure_transition(..., _TRANSITIONS)`.
- **`resolved` requires `resolution_summary`** (`422 SUMMARY_REQUIRED`) and stamps `resolved_at`.
- `update_incident` (severity / location / description) refuses once `closed` / `false_alarm`.
- every move writes `incident_status_history` + `incident.<status>` audit.
- endpoint: `POST /incidents/{id}/transition`. Assignments: one active per `(incident,user)`.

### 2.4 `maintenance_invoices.status`  (billing)

`draft → posted → partially_paid → paid ∎` · `{draft,posted,overdue} → cancelled ∎`.

- **Posting freezes the invoice** — `post_invoice` (draft only) writes a ledger **debit**.
- Payment (simulated) is service-only: `record_payment` verifies `Σ allocations == amount`,
  each invoice `posted/partially_paid/overdue`, `allocation ≤ balance_due`; advances
  `posted → partially_paid → paid`; writes ledger **credits**; all one transaction.
- **No `paid → unpaid`** — the FR defines no reversal/refund workflow.
- `cancel_invoice` refused when `amount_paid > 0` (`INVOICE_HAS_PAYMENTS`).
- `payments.payment_status` (`pending/success/failed/refunded`) — set once to `success` by the
  simulator; no transition endpoint (no real gateway).
- endpoints: `POST /billing/invoices/{id}/post` · `…/cancel` · `POST /billing/payments`.

### 2.5 `deliveries` — `approval_status` + `status`

`approval_status`: `pending → approved | rejected` · protocol may set `auto_approved` at create.
`status`: `expected → at_gate → {in_transit} → {delivered | collected} ∎` · `→ cancelled ∎`.

- **Protocol (config) is evaluated at create — before any gate event** — deciding
  `auto_approved` vs `pending`.
- `decide_delivery` — pending only; `rejected` also sets `status = cancelled`.
- `record_arrival` — needs `approval_status ∈ {approved, auto_approved}` (`422 NOT_APPROVED`),
  `status ∈ {expected, at_gate}`.
- `mark_delivered` — from `at_gate/in_transit`; `delivered` vs `collected` from
  `protocol.leave_at_gate`.
- endpoints: `…/decision` · `…/arrival` · `…/delivered` · `…/cancel`.

### 2.6 gate — roster · assignment · panic alert

| enum | machine | endpoint |
|---|---|---|
| `guard_rosters.status` | `planned → active → completed ∎` · `{planned,active} → cancelled ∎` | **`POST /gate/rosters/{id}/status`** (removed from `RosterUpdate` this pass) |
| `gate_assignments.status` | `active → ended ∎` | `POST /gate/assignments/{id}/end` |
| `panic_alerts.status` | `active → acknowledged → resolved ∎` · `{active,acknowledged} → cancelled ∎` (raiser only) | `…/acknowledge` · `…/resolve` · `…/cancel` |

- **panic ack sets `acknowledged_by` + `acknowledged_at` together**; `resolve` from `active`
  back-fills both. `cancel` restricted to `triggered_by_user_id` (`403 NOT_ALERT_OWNER`).
- `gate_events` — append-only (§C).

### 2.7 domestic_staff

| enum | machine | endpoint |
|---|---|---|
| `staff_unit_assignments.is_active` | active → ended (`is_active=false`) | `POST /assignments/{id}/end` |
| `staff_attendance.attendance_status` | `inside → left` · single open row per staff | `POST /attendance/check-in` · `PATCH …/check-out` |
| `police_verification_status` | `not_started → pending → {verified, rejected}` · `rejected ⇄ pending` · `verified ⇄ pending` · `→ expired → pending` | `PATCH /domestic-staff/{id}` — service `ensure_transition` guard (admin data field; low frequency, no separate endpoint) |

### 2.8 vehicles

| enum | machine | endpoint |
|---|---|---|
| `parking_allocations.status` | `active → released ∎` | `POST /parking/allocations/{id}/release` |
| `vehicle_entries.status` | `inside → exited ∎` · one open per plate | `PATCH /entries/{id}/exit` |
| `parking_violations.status` | `open → {acknowledged, resolved, waived}` · `acknowledged → {resolved, waived}` · resolved/waived ∎ | `POST /parking/violations/{id}/status` |
| `parking_slots.status` | `available ⇄ allocated` (driven by allocate/release, not a user field) | — |

### 2.9 residents

| enum | machine | endpoint |
|---|---|---|
| `move_records.status` | `requested → scheduled → approved → completed ∎` · `→ rejected ∎` / `→ cancelled ∎` | `PATCH /residents/move-records/{id}/status` |
| `resident_profiles.profile_status` | `pending → active` · `active ⇄ suspended` · `{active,suspended} → moved_out` · `moved_out → active` (returning) | `PATCH /residents/{id}` — service `ensure_transition` guard |
| `resident_profiles.kyc_status` | `not_started → submitted → {verified, rejected}` · `rejected ⇄ submitted` · `verified → submitted` (re-KYC) | same |

### 2.10 amenities · communication · notifications

| enum | machine | endpoint |
|---|---|---|
| `amenity_bookings.status` | `confirmed → {cancelled ∎, completed ∎, no_show ∎}` | `…/cancel` (owner or `amenities:update`; owner also subject to `min_cancel_hours`) · `…/status` (`completed`/`no_show`, `amenities:update`) |
| `announcements.is_published` | `false → true` (**freeze** — `update` refused once published; only `expire` may touch it after) | `POST /communication/announcements/{id}/publish` |
| `polls.status` | `draft → open → closed ∎` · **opening requires the announcement published** | `POST /communication/polls/{id}/status` |
| poll voting | one `poll_responses` row per `(poll, user)` (UQ); `open` window enforced; `allow_multiple` gates multi-option | `POST /communication/polls/{id}/vote` |
| `notifications.is_read` | `false → true` (user interaction, idempotent) | `POST /notifications/{id}/read` · `…/read-all` |
| `notification_deliveries.status` | delivery outcome, written once per channel (`delivered` / `skipped`) | — (no transition endpoint) |

---

## 3. Changes made in this pass

| area | change |
|---|---|
| `app/core/state_machine.py` | **new** — `ensure_transition` / `can_transition` / `is_terminal`, `TransitionMap` |
| complaints | `transition_ticket` → `ensure_transition(_TICKET_ACTIONS)`; documented that `closed`/`reopened` are confirm-only |
| incidents | `transition_incident` → `ensure_transition(_TRANSITIONS)` |
| residents | `_PROFILE_TRANSITIONS` + `_KYC_TRANSITIONS` guards added to `update_profile`; `transition_move` → shared helper |
| domestic_staff | `_VERIFICATION_TRANSITIONS` guard added to `update_staff` |
| gate | **`status` removed from `RosterUpdate`**; new `RosterTransition` + `transition_roster` + `POST /gate/rosters/{id}/status` |
| tests | +4 (residents profile/kyc, staff verification, gate roster endpoint separation, incident terminal) |

## 4. Bypass-path audit (post-implementation)

- Grep for `.status =` / `status=` writes outside services → **none** (routers thin,
  repositories read-only filters, `tasks.py` are empty stubs — no background status writes).
- AST scan for `status` in every `*Update` / `*Patch` schema → after this pass the only hits
  are `CommunityUpdate.state` (postal *state*, not a workflow) and the service-guarded
  `profile_status` / `kyc_status` / `police_verification_status` admin fields.
- Every lifecycle move writes its audit row (and history row where a history table exists) in
  the same transaction as the state change.

## 5. Ambiguities deliberately left conservative

- **Visitor pass** kept as `is_revoked` + counters rather than an `ISSUED/ACTIVE/USED/…` enum
  — the FR never names those states and the current booleans already make the forbidden jumps
  (`used/expired/revoked → active`) impossible. Converting to a named enum is cosmetic and was
  not done to avoid inventing a workflow.
- `profile_status` / `kyc_status` / `police_verification_status` stay on the generic
  `PATCH` body (with a service transition guard) rather than getting their own endpoints —
  they are low-frequency admin corrections, not high-traffic operational workflows.
- `payments.payment_status` has no transition endpoint (simulated, single `success` write).

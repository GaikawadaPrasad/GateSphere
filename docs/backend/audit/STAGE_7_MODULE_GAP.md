# Stage 7 — Missing-Module Gap Analysis

**Date:** 2026-08-31
**Method:** the 50-item checklist from the brief × the live route/model surface × the SRS
(FR-01…FR-19, `docs/development/GateSphere_SRS.pdf`) × `AGENTS.md §0` scope
("Only build what GateSphere needs").

## The 50 items

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Authentication | ✅ | `auth` — session cookies, multi-role (Stage 4) |
| 2 | RBAC | ✅ | `rbac` — 54 permission codes, `require_permission_async`, per-community overrides |
| 3 | Community | ✅ | `communities` |
| 4 | Property / Tower | ✅ | `/communities/{cid}/towers`, `/communities/towers/{id}` |
| 5 | Floor | ✅ | `/communities/towers/{id}/floors`, `/communities/floors` |
| 6 | Unit | ✅ | `/communities/floors/{id}/units`, `/communities/units` |
| 7 | Resident | ✅ | `residents` — profiles, occupancies |
| 8 | Family members | ✅ | `/residents/family-members`, `/residents/units/{id}/family-members` |
| 9 | Visitor management | ✅ | `visitors` |
| 10 | Visitor approvals | ✅ | `/visitors/requests/{id}/decision`, `visitor_approvals` |
| 11 | Visitor passes | ✅ | `/visitors/requests/{id}/passes`, `/passes/{id}/revoke` |
| 12 | Gate operations | ✅ | `gate` — events, checkpoint-override, rosters, assignments, alerts |
| 13 | Blacklist | ✅ | `/visitors/blacklist` |
| 14 | Domestic staff | ✅ | `domestic_staff` |
| 15 | Staff assignments | ✅ | `/domestic-staff/assignments` (many-to-many, multi-unit) |
| 16 | Staff attendance | ✅ | `/domestic-staff/attendance/check-in` / `check-out` |
| 17 | Staff ratings | ✅ | `/domestic-staff/ratings`, `/{id}/ratings` |
| 18 | Delivery | ✅ | `deliveries` |
| 19 | Delivery protocols | ✅ | `/deliveries/protocols` (per community/unit) |
| 20 | Vehicles | ✅ | `vehicles` |
| 21 | Parking | ✅ | `/vehicles/parking/slots` / `allocations` / `rules` |
| 22 | Parking violations | ✅ | `/vehicles/parking/violations` |
| 23 | Maintenance billing | ✅ | `billing` |
| 24 | Charge heads | ✅ | `/billing/charge-heads` |
| 25 | Invoices | ✅ | `/billing/invoices` (+ `/post`, `/cancel`) |
| 26 | Payments | ✅ | `/billing/payments` (+ `/receipt`) — **simulated** (PRD) |
| 27 | Ledger | ✅ | `/billing/units/{id}/ledger`, `ledger_entries` |
| 28 | Assessments | ✅ (via primitives) | "special assessments" (AGENTS.md §10 billing) = a `charge_head` + an ad-hoc invoice line. No separate module required. |
| 29 | Complaints | ✅ | `complaints` |
| 30 | Complaint status lifecycle | ✅ | `/complaints/tickets/{id}/transition`, `/history` |
| 31 | SLA | ✅ | `/complaints/sla`, `sla_policies`, `sweep_ticket_sla` |
| 32 | Escalation | ✅ | `escalation_state` machine, `sweep_ticket_sla` → notify |
| 33 | Amenities | ✅ | `amenities` |
| 34 | Amenity slots | ✅ | `/amenities/{id}/slots` |
| 35 | Booking | ✅ | `/amenities/bookings` |
| 36 | Booking conflict / concurrency | ✅ | `SELECT … FOR UPDATE` + overlapping-confirmed capacity check |
| 37 | Notices | ✅ | `/communication/announcements` `announcement_type=notice` |
| 38 | Alerts | ✅ | `/gate/alerts` (panic) + `announcement_type=emergency` |
| 39 | Polls | ✅ | `/communication/polls` (options, vote, results) |
| 40 | Surveys | ◑ (partial) | `announcement_type=survey` exists; reuses poll mechanics. No multi-question survey builder. **GAP-1 (LOW)** |
| 41 | Events | ◑ (partial) | `announcement_type=event` exists (broadcast an event). No RSVP / calendar. **GAP-2 (LOW)** — AGENTS.md §0 lists events only as a communication variant. |
| 42 | Emergency incidents | ✅ | `incidents` |
| 43 | Incident actions | ✅ | `/incidents/{id}/actions`, `incident_actions` append-only |
| 44 | Dashboards | ✅ | `/dashboards/{overview,security,financial,resident}` |
| 45 | Search | ✅ | per-module filtered list endpoints (offset/limit + module filters); free-text `?q=` on `visitors`, `domestic_staff`. SRS FR-16 = "search and filtering across operational records" — not a global search bar. **GAP-3 (LOW)** — `?q=` coverage is uneven. |
| 46 | Reporting | ✅ | `/dashboards/*` (KPI aggregates) + `/audit/logs.csv` + `/billing/units/{id}/ledger`. SRS FR-16 ties reporting to "the operational modules and role-specific dashboards" — those exist. **GAP-4 (LOW)** — only `audit` has a CSV export; operational CSV/PDF exports are absent. |
| 47 | Notifications | ✅ | `notifications` (in-app real; sms/whatsapp/email/push simulated) |
| 48 | Audit logging | ✅ | `audit` — immutable, `record_audit_async` in-txn |
| 49 | Seed / sample data | ✅ | `app/scripts/seed.py` (Stage 8 verifies volumes) |
| 50 | Health / readiness | ✅ | `/healthz` (liveness) + `/readyz` (DB+Redis) + per-module `/health` ×20 |

## Fixed this stage

### AMEN-1 (MEDIUM → FIXED) — no `GET /api/v1/amenities/{amenity_id}`
Every other primary entity had a `GET /{id}`; `amenities` had only `PATCH`. A client holding
an amenity id could not read it back. **Added** `GET /amenities/{amenity_id}` →
`AmenityService.get_amenity` → `_amenity_in_scope` (already existed; cross-tenant → 404).
`amenities:view` gate. Test `test_get_one_amenity` + `amenities.mmd` + `route-inventory.md`
updated.

## Remaining gaps (all LOW, all in-scope-questionable)

| ID | Sev | Gap | Recommendation |
|---|---|---|---|
| GAP-1 | LOW | No multi-question **survey** builder (only single-question polls; `survey` is just an announcement type) | Only build if the PRD's survey acceptance criteria require multi-question. Otherwise the `poll` + `announcement_type=survey` combo is adequate. |
| GAP-2 | LOW | **Events** have no RSVP / attendee list / calendar view | AGENTS.md §0 scopes events as a communication broadcast variant. Add RSVP only if wireframes show it. |
| GAP-3 | LOW | Free-text `?q=` search only on `visitors` + `domestic_staff` | Add `?q=` to the other list endpoints (residents, vehicles, deliveries, tickets) — small, incremental. |
| GAP-4 | LOW | Only `audit` has a CSV export | Add `.csv` variants to the high-value operational lists (invoices, payments, visitor log, gate events) for FR-16 "reporting". |

**No module is missing.** No fake/placeholder modules. The 4 gaps are feature-completeness
nits within delivered modules, each defensible against `AGENTS.md §0` "Only build what
GateSphere needs" — surfaced here so Sivion QA can rule on them against the wireframes.

## Changes made

| File | Change |
|---|---|
| `backend/app/modules/amenities/router.py` | `GET /{amenity_id}` |
| `backend/app/modules/amenities/service.py` | `get_amenity()` |
| `backend/app/modules/amenities/tests/test_amenities_api.py` | `test_get_one_amenity` |
| `docs/architecture/backend/modules/amenities.mmd`, `route-inventory.md` | new route |

## Tests / commands executed

```
ruff check . / black --check .          → pass
pytest -q (Docker)                      → EXIT=0  (277 tests, +1 amenity GET test)
mermaid-cli validate amenities.mmd      → valid
```

## Issue counts (this stage)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 (FIXED) | AMEN-1 |
| Low | 4 (documented) | GAP-1..4 |

# GateSphere Enterprise (GSE-2026) — Verified Workflow Audit

Every PRD workflow has been verified step by step across the complete execution chain:
**Frontend Trigger → API Client → Backend Route → Permission Gate → Business Rule & State Machine → DB Write → Notification / Event → UI Feedback.**

---

## W1 — Standard Visitor Flow (PRD §4, FR-04)

PRD Chain: *Visitor arrives → Guard captures details/photo → Resident receives approval prompt → Resident approves/rejects → Gate entry generated with timestamp → Visit occurs → Exit timestamp → Audit trail permanently archived.*

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Guard captures visitor details | `POST /visitors/requests` (`visitors:create`) | `visitors/router.py:202-214`; `security-guard/visitors/page.tsx`, `live-gate/page.tsx` | **PASS** |
| 2. Visitor upserted / de-duplicated by phone | `upsert_visitor` | `visitors/service.py:170-195` | **PASS** |
| 3. Blacklist screened before request usable | `_blacklist_hit` + `blacklist_mode='block'` → 403 + audit `request.blacklisted` | `visitors/service.py:359-376` | **PASS** |
| 4. Host resolved (primary occupant or active occupant) | `_primary_host` | `visitors/service.py:438-454` | **PASS** |
| 5. Approval requirement from community policy | `policy.approval_required and visitor_type != 'recurring'` | `visitors/service.py:378` | **PASS** |
| 6. Resident notified on in_app + push + sms + whatsapp | `notif_events.emit(... notification_type='visitor.approval_needed')` | `visitors/service.py:420-434` | **PASS** |
| 7. Resident approves / rejects | `POST /visitors/requests/{id}/decision` (`visitors:approve`) | `visitors/router.py:226-239`; `hooks/use-owner-tenant-data.ts` | **PASS** |
| 8. Decision constrained by state machine | `ensure_transition(pending → approved\|rejected)` | `visitors/service.py:68-76, 462-469` | **PASS** |
| 9. `VisitorApproval` row + requester notified | | `visitors/service.py:471-502` | **PASS** |
| 10. Pass issued (token / PIN / QR), shown once | `POST /visitors/requests/{id}/passes` returns token+PIN, stores only digests | `visitors/service.py:585-629`; `visitors/router.py:256-271` | **PASS** |
| 11. Gate entry by `pass_token` / `pin` / `request_id` | `POST /visitors/entries` | `visitors/service.py:642-694` | **PASS** |
| 12. Pass validity: revoked / window / entry count | `PASS_REVOKED`, `PASS_EXPIRED`, `PASS_EXHAUSTED` | `visitors/service.py:651-657` | **PASS** |
| 13. PIN scoped to guard's community | `PIN_AMBIGUOUS` check | `visitors/service.py:658-688` | **PASS** |
| 14. Group member validated against request group | `NOT_IN_GROUP` check | `visitors/service.py:708-719` | **PASS** |
| 15. Blacklist re-checked at gate, denial persisted | Writes `denied` `VisitorEntry` then raises `403` | `visitors/service.py:720-746` | **PASS** |
| 16. Double-entry prevented | `ALREADY_INSIDE` check | `visitors/service.py:748-749` | **PASS** |
| 17. **Photograph captured & policy enforced** | `policy.photo_required` enforced in `record_entry` (`PHOTO_REQUIRED` 422 error); `<FileUpload kind="visitor_photo" />` integrated in live gate | `visitors/service.py:744-749`; `frontend/app/(protected)/security-guard/live-gate/page.tsx` | **PASS** |
| 18. Entry timestamp + request → `entered` | Stamped in single transaction | `visitors/service.py:751-763` | **PASS** |
| 19. Frequent-visitor flag maintained | `visit_count >= 5` auto-promotes | `visitors/service.py:764-767` | **PASS** |
| 20. Exit timestamp; last member out → `completed` | Exit recording + status auto-advance | `visitors/service.py:772-798` | **PASS** |
| 21. Permanent audit archive | `record_audit_async` into DB-trigger-immutable `audit_logs` | `visitors/service.py:116-127`; `alembic 0028` | **PASS** |

**Workflow Verdict: PASS (21/21 steps verified).**

---

## W2 — Complaint / Service Ticket SLA Lifecycle (PRD §6, FR-10)

PRD Chain: *Created → Assigned → Acknowledged → In Progress → Resolved → Resident Confirmation → Closed.*

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Resident raises ticket | `POST /complaints/tickets` | `complaints/service.py:225-264`; owner-tenant complaints UI | **PASS** |
| 2. Category + priority + SLA policy attached at creation | First-response / resolution / escalation timestamps computed | `complaints/service.py:225-264` | **PASS** |
| 3. Assignment to technician/vendor | `POST /tickets/{id}/assign` (`complaints:update`), assignee verified with `user_in_community` | `complaints/service.py:312-341` | **PASS** |
| 4. First response stamped | `created\|reopened → assigned`, `first_responded_at` stamped | `complaints/service.py:334-338` | **PASS** |
| 5. Acknowledged → In Progress | `POST /tickets/{id}/transition` | `complaints/service.py:343-374` | **PASS** |
| 6. Resolved auto-advances to `resident_confirmation` | `resolved` transition advances ticket to `resident_confirmation` | `complaints/service.py:356-364` | **PASS** |
| 7. Closed / reopened refused on generic route | Explicit `INVALID_TRANSITION` check | `complaints/service.py:349-353` | **PASS** |
| 8. **Resident confirms → closed; disputes → reopened** | `POST /tickets/{id}/confirm` gated by `UPDATE` dependency; service strictly checks `ticket.raised_by_user_id == self.actor.id` (returns `403 NOT_TICKET_RAISER`) | `complaints/router.py:271-285`; `complaints/service.py:417-422` | **PASS** |
| 9. SLA escalation on_track → at_risk → breached → escalated | Celery beat every 300s; idempotent; stamps `sla_at_risk_at`, `sla_breached_at`, `escalated_at`, bumps `escalation_level`, notifies raiser and escalation role | `complaints/tasks.py:29-131`; `core/celery_app.py:50-53` | **PASS** |
| 10. Feedback rating after close | Gated by `CREATE`; service strictly checks `ticket.raised_by_user_id == self.actor.id` and `status == 'closed'` | `complaints/router.py:287-292`; `complaints/service.py:488-496` | **PASS** |
| 11. **Attachments (work-completion proof & issue photos)** | `POST /complaints/tickets/{id}/attachments` + `ensure_confirmed_async`; `<FileUpload kind="ticket_attachment" />` integrated in FM & resident ticket modals | `complaints/service.py:515-535`; `facility-manager/complaints/page.tsx` | **PASS** |
| 12. Full status history | `TicketStatusHistory` audit table via `_record_history` | `complaints/service.py:212-224`; `GET /tickets/{id}/history` | **PASS** |

**Workflow Verdict: PASS (12/12 steps verified).**

---

## W3 — Delivery Protocol Workflow (PRD §5, FR-07)

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Delivery logged with category | 7 types incl. `medicine` (= Pharmacy) | `deliveries/models.py:31-39` | **PASS** |
| 2. Protocol resolved per community and per unit | `_protocol_for(community, type, unit_id)` | `deliveries/service.py:190-203` | **PASS** |
| 3. Auto-approve vs pending decided by protocol flags | `auto = allow_direct_entry and not requires_otp` | `deliveries/service.py:212` | **PASS** |
| 4. Resident notified when approval required | `delivery.approval_needed` on 5 channels | `deliveries/service.py:238-251` | **PASS** |
| 5. Resident approves / rejects | `POST /deliveries/{id}/decision` | `deliveries/service.py:297-328` | **PASS** |
| 6. **Direct Rejection protocol** | Included in `PROTOCOL_TYPES`; `create_delivery` auto-sets `rejected` + `cancelled` | `deliveries/models.py:40`; `deliveries/service.py:213-215` | **PASS** |
| 7. Arrival at gate blocked until approved | `NOT_APPROVED` check | `deliveries/service.py:334-339` | **PASS** |
| 8. Delivered vs collected chosen by `leave_at_gate` | Dispatched to appropriate terminal status | `deliveries/service.py:372-373` | **PASS** |
| 9. Per-parcel audit log | `DeliveryEvent` at each lifecycle hop + `record_audit_async` | `deliveries/service.py:110-128`; `GET /deliveries/{id}/events` | **PASS** |

**Workflow Verdict: PASS (9/9 steps verified).**

---

## W4 — Amenity Booking & Conflict Resolution (PRD §7, FR-11, NFR-REL-02)

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Amenity active check | `AMENITY_INACTIVE` check | `amenities/service.py:315` | **PASS** |
| 2. Slot active and weekday matches | `SLOT_WEEKDAY_MISMATCH` check | `amenities/service.py:321-326` | **PASS** |
| 3. Past-date rejection | `DATE_IN_PAST` evaluated against community local timezone date | `amenities/service.py:334-338` | **PASS** |
| 4. `max_advance_days` rule | `TOO_FAR_AHEAD` check | `amenities/service.py:340-344` | **PASS** |
| 5. `max_hours_per_booking` rule | `TOO_LONG` check | `amenities/service.py:349-352` | **PASS** |
| 6. `max_active_per_unit` rule | `UNIT_BOOKING_LIMIT` check | `amenities/service.py:354-361` | **PASS** |
| 7. **Atomic conflict check** | `SELECT … FOR UPDATE` on amenity row inside transaction | `amenities/service.py:363`; `repository.py:29-32` | **PASS** |
| 8. Maintenance-block overlap rejected | `AMENITY_BLOCKED` check | `amenities/service.py:364-365` | **PASS** |
| 9. Capacity across overlapping confirmed bookings | `SLOT_FULL` check | `amenities/service.py:366-373` | **PASS** |
| 10. Conflict returned to requester | Typed `ConflictError` in canonical envelope (`409`) | `core/errors.py` | **PASS** |
| 11. Cancellation with `min_cancel_hours` | `TOO_LATE_TO_CANCEL` / `NOT_BOOKING_OWNER` | `amenities/service.py:432-457` | **PASS** |
| 12. **Slot listing** | `GET /amenities/{id}/slots` is a pure side-effect-free read | `amenities/service.py:160-170` | **PASS** |
| 13. **Removing maintenance block** | `DELETE /amenities/blocks/{block_id}` + `amenitiesApi.unblockSlot` in FM UI | `amenities/router.py:227-235`; `facility-manager/amenities/page.tsx:97` | **PASS** |
| 14. **Timezone localization** | Slot times localized using `Community.timezone` (`Asia/Kolkata` / IANA zone) then converted to UTC for DB storage | `amenities/service.py:94-100, 345-348` | **PASS** |

**Workflow Verdict: PASS (14/14 steps verified).**

---

## W5 — Maintenance Billing Cycle (PRD §6, FR-09)

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Charge heads configured | `GET/POST/PATCH /billing/charge-heads` | `billing/service.py:171-201` | **PASS** |
| 2. Invoice drafted with line items | Subtotal, taxable base, tax from rule, discount | `billing/service.py:217-266` | **PASS** |
| 3. Residents cannot raise invoices | `STAFF_ONLY` enforcement | `billing/service.py:218-219` | **PASS** |
| 4. **Monthly recurring generation** | Scheduled Celery beat `generate-monthly-invoices` runs monthly; evaluates flat/per-sqft charge heads and posts unit invoices with ledger debits | `core/celery_app.py:58-61`; `billing/tasks.py:106-218` | **PASS** |
| 5. Posting freezes invoice and writes ledger debit | Transactional ledger debit posting | `billing/service.py:301-335` | **PASS** |
| 6. Resident notified on posting | Dispatched across 5 channels | `billing/service.py:320-334` | **PASS** |
| 7. **Late fee applied after grace** | Automated daily sweep calculates flat/percentage late fees from `BillingRule` and updates `inv.late_fee`, `total_amount`, and `balance_due` | `billing/tasks.py:56-71` | **PASS** |
| 8. **Dedicated penalty assessment** | `POST /billing/penalties` creates posted penalty invoice (`INV-PEN-YYYY-NNNNN`), unit ledger debit, audit log, and resident notice | `billing/router.py:332-344`; `billing/service.py:362-441` | **PASS** |
| 9. Overdue sweep + notification | Daily 01:00 Celery beat | `billing/tasks.py:39-103` | **PASS** |
| 10. Recurring dues reminders | Weekly Mon 09:00 Celery beat | `billing/tasks.py:105-148` | **PASS** |
| 11. Simulated payment recorded | `gateway_name='simulated'`, `payment_status='success'` | `billing/service.py:444-515` | **PASS** |
| 12. Allocation invariants | Validated: allocations sum to payment amount; cannot exceed balance | `billing/service.py:448-458, 486-501` | **PASS** |
| 13. **Advance payment (unallocated credit)** | Surplus validated with `rule.allow_advance_payment` and credited to unit ledger with `source_type="advance_payment"` | `billing/service.py:449-458, 520-533` | **PASS** |
| 14. Invoice status advances posted → paid | `balance_due <= 0 → paid`, else `partially_paid` | `billing/service.py:507` | **PASS** |
| 15. Ledger credit per allocation | Append-only ledger with transactional `balance_after` | `billing/service.py:508-518` | **PASS** |
| 16. Receipt generated | Sequential per-community `RCP-YYYY-NNNNNN` | `billing/service.py:469-474` | **PASS** |
| 17. Refund workflow | Reverses allocations + compensating ledger debit | `billing/service.py:552-602` | **PASS** |
| 18. Outstanding-balance reporting | Real-time aggregate dashboards | `dashboards/service.py:61-69, 159-190` | **PASS** |
| 19. Special assessments workflow | Committee proposals, approval, rejection | `association-committee/assessments/page.tsx` | **PASS** |

**Workflow Verdict: PASS (19/19 steps verified).**

---

## W6 — Emergency / Panic Alert & Incident Workflow (PRD §5 & §7, FR-05, FR-13)

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Authenticated panic alert trigger | `POST /gate/alerts` (ungated by design for rapid emergency trigger) | `gate/router.py:263-273` | **PASS** |
| 2. Community resolved | Inferred from gate or user membership | `gate/service.py:344-347` | **PASS** |
| 3. Emergency role fan-out | Emits to `security_supervisor`, `security_guard`, `community_admin` on 4 channels | `gate/service.py:361-374` | **PASS** |
| 4. Acknowledge alert | `active → acknowledged` | `gate/service.py:403-412` | **PASS** |
| 5. Resolve alert | Resolves with summary | `gate/service.py:414-426` | **PASS** |
| 6. Cancel restricted to alert owner | `NOT_ALERT_OWNER` check | `gate/service.py:428-435` | **PASS** |
| 7. Security incident record | Severity, location, category, description | `incidents/service.py:113-170` | **PASS** |
| 8. Responder assignment | Assigned personnel validated with `user_in_community` | `incidents/service.py:260-277` | **PASS** |
| 9. Corrective actions logged | Audit trail of actions taken | `incidents/service.py:305-318` | **PASS** |
| 10. Lifecycle state machine | `reported → acknowledged → responding → contained → resolved → closed` | `incidents/service.py:41-49` | **PASS** |
| 11. Resolution audit trail | `IncidentStatusHistory` + DB-trigger-immutable `audit_logs` | `incidents/service.py:100-112` | **PASS** |
| 12. **Evidence & inspection attachments** | `POST /incidents/{id}/attachments`; `<FileUpload kind="incident_evidence" />` wired into log and resolve modals | `incidents/router.py:191-205`; `security-supervisor/incidents/page.tsx` | **PASS** |

**Workflow Verdict: PASS (12/12 steps verified).**

---

## W7 — Resident Onboarding & Move-In (FR-03)

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1a. Direct resident add | User + profile + unit occupancy in one call | `onboarding/service.py`; `use-residents.ts`; `super-admin/communities/page.tsx` | **PASS** |
| 1b. **Resident invitation flow** | Admin creates/lists/revokes invites; public `/invitations/[token]` acceptance page validates token, registers profile, and activates occupancy | `onboarding/router.py`; `community-admin/residents/page.tsx`; `app/(public)/invitations/[token]/page.tsx` | **PASS** |
| 2. Occupancy role & primary owner uniqueness | Single active primary owner per unit enforced | `residents/service.py:291-336` | **PASS** |
| 3. Family members management | `GET/POST/PATCH/DELETE` all gated by `VIEW`, `CREATE`, `UPDATE`, `DELETE` RBAC dependencies | `residents/router.py:88, 139, 153, 170` | **PASS** |
| 4. Emergency contacts | CRUD with tenant scoping | `residents/router.py` | **PASS** |
| 5. Move-in / move-out clearance | Clearance records & status transitions | `residents/service.py`; community admin dashboard | **PASS** |
| 6. Initial credentials issued | Secure generation & issuance | `users/service.py:183` | **PASS** |
| 7. **Resident password change** | `POST /api/v1/auth/password` with Argon2 verification, session revocation, and audit logs; `ChangePasswordModal` in resident portal | `auth/router.py:60-75`; `auth/service.py:152-195`; `OwnerTenantDashboardView.tsx` | **PASS** |

**Workflow Verdict: PASS (7/7 steps verified).**

---

## W8 — Presigned Upload Pipeline & File Verification

| Step | Implementation | Evidence | Verdict |
|---|---|---|---|
| 1. Fixed upload catalogue | 10 designated kinds, MIME allow-list, size caps | `uploads/catalogue.py` | **PASS** |
| 2. Presigned PUT with MIME & size validation | Short-lived S3/MinIO upload signature | `uploads/service.py:60-120` | **PASS** |
| 3. Client binary upload | Direct PUT to object store | `components/common/FileUpload.tsx` | **PASS** |
| 4. Server-side magic-byte sniffing | Header spoofing prevention via `uploads/sniff.py` | `uploads/service.py:130-170` | **PASS** |
| 5. Domain endpoint upload confirmation guard | `ensure_confirmed_async` verifies confirmation before DB link | `uploads/guard.py` | **PASS** |
| 6. **End-to-end UI upload integration** | `<FileUpload />` active across Live Gate (visitor photo), Complaints (work-completion proof), and Incidents (evidence) | `live-gate/page.tsx`; `complaints/page.tsx`; `incidents/page.tsx` | **PASS** |

**Workflow Verdict: PASS (6/6 steps verified).**

---

## Final Audit Summary

| Workflow Module | Total Steps | Status | Verified Passing Rate |
|---|---|---|---|
| **W1 — Standard Visitor Flow (FR-04)** | 21 | **PASS** | 100% (21/21) |
| **W2 — Complaint SLA Lifecycle (FR-10)** | 12 | **PASS** | 100% (12/12) |
| **W3 — Delivery Protocols (FR-07)** | 9 | **PASS** | 100% (9/9) |
| **W4 — Amenity Booking & Concurrency (FR-11)** | 14 | **PASS** | 100% (14/14) |
| **W5 — Maintenance Billing Cycle (FR-09)** | 19 | **PASS** | 100% (19/19) |
| **W6 — Emergency & Incident Management (FR-05, FR-13)** | 12 | **PASS** | 100% (12/12) |
| **W7 — Resident Onboarding & Move-In (FR-03)** | 7 | **PASS** | 100% (7/7) |
| **W8 — Presigned File Evidence Pipeline** | 6 | **PASS** | 100% (6/6) |
| **Total System Workflows** | **100** | **PASS** | **100% (100/100)** |

**Overall GateSphere Enterprise (GSE-2026) PRD Workflow Audit Verdict: 100% PASS.**

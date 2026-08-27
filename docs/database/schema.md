# Database — Canonical Schema (from ERD v1.2)

Source of truth: **`GateSphere_DB_ERD.pdf` — "GateSphere Enterprise — Module-Wise Database ER
Diagrams, v1.2, Team Implementation Baseline"**. This page transcribes that ERD for
implementation. Schema changes go through Alembic only (see [migrations.md](migrations.md)) and
must update this page in the same PR.

## Conventions (apply to every table)

- **PK** `id` = **UUID v4** (application-generated) — a deliberate deviation from ERD v1.2's
  BIGINT identity, recorded in [ADR-009](../decisions/ADR-009-identifiers.md). Every other
  detail below still holds. Helpers: `pk()` / `fk()` / `TenantMixin` in
  `backend/app/db/base_class.py`.
- Every tenant-scoped table carries `community_id NOT NULL` (UUID FK) + index, and uses
  **composite tenant-safe FKs** to parents (`(community_id, parent_id)`).
- Mutable tables: `created_at`, `updated_at` `TIMESTAMPTZ` (+ `created_by` where an actor exists).
- Append-only tables: `created_at`/`occurred_at`/`changed_at` only — **INSERT only**, enforced by
  trigger/RLS in staging.
- Money `NUMERIC(12,2)`. Timestamps `TIMESTAMPTZ`. Enums `VARCHAR` + `CHECK`.
- FKs enforced at DB level with explicit `ON DELETE`. RLS on tenant tables in staging/prod.

## Enforcement split (ERD banner, every diagram)

> **PostgreSQL** = integrity / RLS / immutability · **Backend** = workflows / business rules ·
> **Frontend** = UX validation only.

---

## 01 · Identity & RBAC

| Table | Key columns | Notes |
|-------|-------------|-------|
| `users` | `email` (UQ), `phone`, `password_hash`, `first_name`, `last_name`, `status`, `is_verified`, `last_login_at` | Argon2 hash. |
| `user_sessions` | `user_id` FK, `session_key_hash` (UQ, VARCHAR 128 — SHA-256 of the cookie token), `csrf_token`, `ip_address` INET, `user_agent`, `created_at`, `expires_at`, `revoked_at` | **Canonical session store** (migration `0002`). Redis caches lookups. Revoked on logout / password / role change. |
| `communities` | `code` (UQ) | Tenant root. |
| `user_communities` | `user_id`, `community_id`, `membership_status`, `joined_at`, `left_at` | UQ `(user_id, community_id)`. |
| `roles` | `code` (UQ), `name`, `scope_level` (`GLOBAL`/`COMMUNITY`), `is_system` | Fixed enumeration of the 10 roles. |
| `permissions` | `code` (UQ), `module`, `action` | `"<module>:<action>"`. |
| `role_permissions` | `role_id`, `permission_id` | UQ `(role_id, permission_id)`. |
| `user_roles` | `user_id`, `role_id`, `community_id` (NULL = global), `assigned_by_user_id`, `assigned_at`, `is_active` | UQ `(user_id, role_id, community_id)`. `CHECK (scope GLOBAL ⇒ community_id NULL; COMMUNITY ⇒ NOT NULL)`. Community-scoped role requires an ACTIVE `user_communities` membership. |

## 02 · Community, Property & Residents

| Table | Key columns | Notes |
|-------|-------------|-------|
| `communities` | `code` (UQ), `name`, `address_line1/2`, `city`, `state`, `postal_code`, `country`, `timezone`, `is_active` | |
| `gates` | `community_id`, `code`, `name`, `gate_type`, `latitude`, `longitude`, `is_active` | |
| `towers` | `community_id`, `code`, `name`, `structure_type`, `total_floors`, `is_active` | UQ `(community_id, name)`. |
| `floors` | `community_id`, `tower_id`, `floor_number`, `label`, `is_active` | UQ `(community_id, tower_id, floor_no)`. |
| `units` | `community_id`, `tower_id`, `floor_id`, `unit_number`, `unit_type`, `area_sqft`, `is_active` | UQ within chosen property scope. Migration-mandatory composite tenant-safe FK `tower → floor → unit`. |
| `resident_profiles` | `community_id`, `user_id`, `profile_status`, `kyc_status`, `move_in_date`, `move_out_date`, `emergency_notes` | |
| `unit_occupancies` | `community_id`, `unit_id`, `resident_profile_id`, `occupancy_role` (owner/tenant/…), `is_primary`, `start_date`, `end_date`, `agreement_reference`, `is_active` | `CHECK start < end`; prevent overlapping ACTIVE occupancy; partial-unique for one primary active occupant per unit. |
| `family_members` | `community_id`, `unit_id`, `primary_resident_profile_id`, `user_id`, `full_name`, `relationship`, `date_of_birth`, `phone`, `access_enabled` | |
| `emergency_contacts` | `community_id`, `resident_profile_id`, `name`, `relationship`, `phone`, `alternate_phone`, `priority` | |
| `move_records` | `community_id`, `unit_id`, `resident_profile_id`, `move_type`, `requested_at`, `scheduled_at`, `status`, `clearance_notes`, `approved_by_user_id`, `approved_at` | Statutory move-in/move-out clearance. |

## 03 · Visitor Management

| Table | Key columns | Notes |
|-------|-------------|-------|
| `visitors` | `community_id`, `full_name`, `phone`, `photo_url`, `id_type`, `id_number_hash`, `vehicle_number`, `frequent_visitor_flag`, `visit_count`, `last_visit_at` | |
| `visitor_blacklist` | `community_id`, `visitor_id`, `phone_hash`, `id_number_hash`, `reason`, `risk_level`, `active_from`, `active_until`, `is_active`, `created_by_user_id` | Lookup always community-scoped; checked **before** any gate transaction. |
| `visitor_groups` | `community_id`, `created_by_user_id`, `group_name`, `purpose`, `expected_at` | Multi-visitor entry under one approval. |
| `visitor_requests` | `community_id`, `visitor_id`, `visitor_group_id`, `unit_id`, `host_user_id`, `created_by_user_id`, `visitor_type`, `purpose`, `expected_at`, `valid_until`, `status`, `approval_required`, `vehicle_number` | States `PENDING→APPROVED→REJECTED→CANCELLED→EXPIRED`; validate every transition. |
| `visitor_approvals` | `request_id`, `approver_user_id`, `decision`, `remarks`, `decided_at` | UQ `(request_id, approver_user_id)`. |
| `visitor_passes` | `request_id`, `pass_type`, `qr_token_hash` (UQ), `pin_hash`, `valid_from`, `valid_to`, `max_entries`, `entry_count`, `is_revoked`, `revoked_at` | `CHECK valid_from < valid_to`; issued/active/used/expired/revoked/cancelled — rejected/expired/revoked cannot produce entry. |
| `visitor_entries` | `community_id`, `request_id`, `visitor_id`, `gate_id`, `entry_guard_user_id`, `exit_guard_user_id`, `entry_at`, `exit_at`, `entry_photo_url`, `vehicle_number`, `status`, `denial_reason` | `CHECK exit_at >= entry_at`. |
| `visitor_policies` | one active row per community: `approval_required`, `photo_required`, `otp_required`, `pass_ttl_minutes`, `blacklist_mode` | Config-as-data. |

## 04 · Security Gate Operations

| Table | Key columns | Notes |
|-------|-------------|-------|
| `gate_events` | `community_id`, `gate_id`, `actor_user_id`, `event_type` (controlled ENUM/CHECK), `reference_type`, `reference_id`, `occurred_at`, `metadata` JSONB | **Append-only.** Shared by visitor / delivery / staff-attendance flows. Index `(community_id, gate_id, occurred_at DESC)`. |
| `guard_rosters` | `community_id`, `guard_user_id`, `shift_date`, `shift_start`, `shift_end`, `supervisor_user_id`, `status` | |
| `gate_assignments` | `community_id`, `guard_user_id`, `gate_id`, `roster_id`, `assigned_from`, `assigned_to`, `status` | Intervals must not overlap where business rule forbids. |
| `panic_alerts` | `community_id`, `triggered_by_user_id`, `gate_id`, `alert_type`, `severity`, `message`, `status`, `triggered_at`, `acknowledged_by_user_id`, `acknowledged_at`, `resolved_at` | Ack requires `acknowledged_by` + `acknowledged_at` together. |

## 05 · Domestic Staff

| Table | Key columns | Notes |
|-------|-------------|-------|
| `domestic_staff` | `community_id`, `user_id`, `full_name`, `staff_type`, `phone`, `photo_url`, `id_type`, `id_number_hash`, `police_verification_status`, `verification_expiry`, `emergency_address`, `is_active` | |
| `staff_unit_assignments` | `community_id`, `staff_id`, `unit_id`, `approved_by_user_id`, `work_type`, `start_date`, `end_date`, `time_from`, `time_to`, `is_active` | Many-to-many (multi-apartment). `CHECK start <= end` when set. UQ active `(staff_id, unit_id)`. |
| `staff_attendance` | `community_id`, `staff_id`, `gate_id`, `check_in_at`, `check_out_at`, `check_in_by_user_id`, `check_out_by_user_id`, `attendance_status` | Append-oriented. `CHECK check_out >= check_in`. At most one open row per staff. |
| `staff_ratings` | `community_id`, `staff_id`, `unit_id`, `resident_user_id`, `rating` SMALLINT, `feedback` | |

## 06 · Delivery Management

| Table | Key columns | Notes |
|-------|-------------|-------|
| `delivery_protocols` | `community_id`, `delivery_type`, `protocol_type`, `requires_otp`, `allow_direct_entry`, `leave_at_gate`, `allowed_start_time`, `allowed_end_time`, `is_active` | **DB source of truth** for protocol rules — never hardcode. |
| `deliveries` | `community_id`, `unit_id`, `resident_user_id`, `delivery_type`, `provider_name`, `executive_name`, `executive_phone`, `tracking_reference`, `protocol_id`, `approval_status`, `approved_by_user_id`, `expected_at`, `arrived_at`, `status`, `parcel_count`, `notes` | Protocol/unit/resident all belong to `deliveries.community_id`. |
| `delivery_events` | `delivery_id`, `gate_id`, `actor_user_id`, `event_type`, `occurred_at`, `remarks`, `metadata` JSONB | **Append-only.** |

## 07 · Vehicle & Parking

| Table | Key columns | Notes |
|-------|-------------|-------|
| `vehicles` | `community_id`, `resident_profile_id` XOR `visitor_id`, `unit_id`, `vehicle_type`, `registration_number`, `make`, `model`, `color`, `sticker_number`, `is_active` | UQ `(community_id, registration_number)`. Ownership per rule: resident XOR visitor. |
| `parking_slots` | `community_id`, `tower_id`, `slot_code`, `slot_type`, `level`, `status`, `is_guest_slot`, `reserved_for_unit_id` | |
| `parking_allocations` | `community_id`, `slot_id`, `vehicle_id`, `unit_id`, `allocated_from`, `allocated_to`, `status`, `allocated_by_user_id` | Partial-UQ one active allocation per slot (unless multi-slot enabled); one active allocation per vehicle. `CHECK from < to`. |
| `parking_violations` | `community_id`, `vehicle_id`, `parking_slot_id`, `reported_by_user_id`, `violation_type`, `description`, `occurred_at`, `evidence_url`, `fine_amount`, `status`, `resolved_at` | |
| `vehicle_entries` | `community_id`, `vehicle_id`, `registration_number`, `gate_id`, `entry_at`, `exit_at`, `entry_guard_user_id`, `exit_guard_user_id`, `source_type`, `reference_id`, `status` | Automated plate logging; unknown plates flagged. |
| `parking_rules` | one active row per community: `allow_multi_slot_vehicle`, `allow_guest_parking`, `max_active_slots_per_unit`, `violation_grace_minutes` | Config-as-data. |

## 08 · Maintenance & Billing

| Table | Key columns | Notes |
|-------|-------------|-------|
| `charge_heads` | `community_id`, `code`, `name`, `calculation_type`, `default_amount`, `taxable`, `is_active` | Flat-wise charge heads. |
| `maintenance_invoices` | `community_id`, `unit_id`, `billed_to_user_id`, `invoice_number`, `billing_period_start/end`, `issue_date`, `due_date`, `subtotal`, `discount`, `late_fee`, `penalty`, `tax`, `total_amount`, `amount_paid`, `balance_due`, `status` | UQ `(community_id, invoice_number)`. Posted = immutable. |
| `invoice_items` | `invoice_id`, `charge_head_id`, `description`, `quantity`, `unit_rate`, `amount`, `metadata` JSONB | |
| `payments` | `community_id`, `payer_user_id`, `payment_reference` (UQ), `amount`, `payment_method`, `payment_status`, `paid_at`, `gateway_name`, `gateway_transaction_id`, `remarks` | **Simulated** — no external gateway. |
| `payment_allocations` | `payment_id`, `invoice_id`, `allocated_amount`, `created_at` | `CHECK allocated_amount > 0`; deferred `sum(allocations) <= payment.amount` and `<= invoice outstanding`. |
| `ledger_entries` | `community_id`, `unit_id`, `user_id`, `entry_type`, `source_type`, `source_id`, `amount`, `balance_after`, `entry_date`, `narration` | Derived / append-only; recompute `balance_after` transactionally. |
| `billing_rules` | one active row per community: `due_day`, `grace_days`, `late_fee_mode`, `late_fee_value`, `allow_advance_payment` | Config-as-data. |

## 09 · Complaint & Service Desk

| Table | Key columns | Notes |
|-------|-------------|-------|
| `service_categories` | `community_id`, `code`, `name`, `default_priority`, `is_active` | plumbing/electrical/housekeeping/lifts/security/common-areas. |
| `sla_policies` | `community_id`, `category_id`, `priority`, `response_minutes`, `resolution_minutes`, `escalation_minutes`, `is_active` | Config-as-data. |
| `service_tickets` | `community_id`, `unit_id`, `ticket_number`, `raised_by_user_id`, `category_id`, `sla_policy_id`, `subject`, `description`, `priority`, `status`, `due_at`, `resident_confirmation_status`, `first_response_due_at`, `resolution_due_at`, `sla_breached_at`, `closed_at` | Lifecycle `Created→Assigned→Acknowledged→In Progress→Resolved→Resident Confirmation→Closed`. **No `Closed` without resident confirmation.** |
| `ticket_status_history` | `ticket_id`, `from_status`, `to_status`, `changed_by_user_id`, `remarks`, `changed_at` | **Append-only**; records every transition. |
| `ticket_assignments` | `ticket_id`, `assigned_to_user_id`, `vendor_id`, `assigned_by_user_id`, `assigned_at`, `unassigned_at`, `is_active` | Internal assignee **XOR** vendor; exactly one active executor. |
| `ticket_messages` | `ticket_id`, `sender_user_id`, `message`, `is_internal`, `created_at` | |
| `ticket_feedback` | `ticket_id` (UQ), `resident_user_id`, `rating` SMALLINT, `comments` | One per ticket. |
| `ticket_attachments` | `ticket_id`, `message_id`, `uploaded_by_user_id`, `file_url`, `file_name`, `mime_type`, `file_size_bytes` | |

## 10 · Facility & Vendor Operations

| Table | Key columns | Notes |
|-------|-------------|-------|
| `vendors` | `community_id`, `name`, `vendor_type`, `contact_person`, `phone`, `email`, `tax_id`, `registration_number`, `status` | |
| `vendor_contracts` | `community_id`, `vendor_id`, `contract_number` (UQ per community), `start_date`, `end_date`, `scope_text`, `contract_value`, `status`, `document_url`, `approved_by_user_id` | |
| `facility_assets` | `community_id`, `tower_id`, `gate_id`, `asset_code`, `asset_name`, `asset_type`, `location_text`, `serial_number`, `installed_on`, `warranty_end`, `status` | |
| `maintenance_schedules` | `community_id`, `asset_id`, `vendor_contract_id`, `schedule_type`, `frequency`, `next_due_at`, `instructions`, `is_active` | |
| `maintenance_work_orders` | `community_id`, `work_order_number`, `schedule_id`, `service_ticket_id`, `asset_id`, `assigned_vendor_id`, `assigned_user_id`, `status`, `priority`, `scheduled_at`, `started_at`, `completed_at`, `completion_notes`, `proof_url` | Work-order assignment validates same community; history auditable. |

## 11 · Amenity Booking

| Table | Key columns | Notes |
|-------|-------------|-------|
| `amenities` | `community_id`, `code`, `name`, `amenity_type`, `location_text`, `capacity`, `booking_required`, `is_active` | clubhouse/gym/pool/tennis/hall/guest-room. |
| `amenity_slots` | `amenity_id`, `day_of_week`, `start_time`, `end_time`, `capacity`, `fee`, `is_active` | |
| `amenity_rules` | `amenity_id`, `rule_type`, `rule_value` JSONB, `effective_from`, `effective_to`, `is_active` | **DB source of truth** for booking rules — never hardcode. |
| `amenity_blocks` | `amenity_id`, `blocked_from`, `blocked_to`, `reason`, `created_by_user_id` | Maintenance blocks; `CHECK from < to`. |
| `amenity_bookings` | `community_id`, `amenity_id`, `slot_id`, `unit_id`, `resident_user_id`, `booking_date`, `start_at`, `end_at`, `participant_count`, `status`, `amount`, `booked_at`, `cancelled_at`, `cancellation_reason` | **Atomic conflict check** (row lock or `EXCLUDE`/partial-unique) against overlapping confirmed bookings; `CHECK start < end`. Unit/resident/amenity same community. |

## 12 · Communication & Broadcasts

| Table | Key columns | Notes |
|-------|-------------|-------|
| `announcements` | `community_id`, `created_by_user_id`, `announcement_type` (notice/emergency/poll/event/survey), `title`, `body`, `priority`, `publish_at`, `expires_at`, `event_start_at`, `event_end_at`, `is_published` | Permanent record once published. |
| `announcement_targets` | `announcement_id`, `tower_id`, `unit_id`, `resident_group_id`, `role_id`, `target_all_community` | `CHECK` a valid target combination; target must belong to the announcement's community. Validate the initiator is authorized for the scope **before** publish. |
| `resident_groups` | `community_id`, `name`, `description`, `created_by_user_id`, `is_active` | |
| `resident_group_members` | `group_id`, `user_id`, `added_at` | |
| `polls` | `community_id`, `announcement_id`, `created_by_user_id`, `question`, `allow_multiple`, `opens_at`, `closes_at`, `status` | |
| `poll_options` | `poll_id`, `option_text`, `display_order` | |
| `poll_responses` | `poll_id`, `user_id`, `responded_at` | UQ `(poll_id, user_id)` unless repeat voting explicitly enabled. |
| `poll_response_options` | `response_id`, `option_id` | UQ `(response_id, option_id)`. |

## 13 · Emergency & Incident Management

| Table | Key columns | Notes |
|-------|-------------|-------|
| `security_incidents` | `community_id`, `incident_number`, `incident_type` (medical/fire/theft/suspicious/breach/lift-entrapment), `severity`, `status`, `tower_id`, `unit_id`, `gate_id`, `location_text`, `reporter_user_id`, `panic_alert_id`, `description`, `reported_at`, `resolved_at`, `resolution_summary` | Current status lives here. |
| `incident_status_history` | `incident_id`, `community_id`, `old_status`, `new_status`, `changed_by_user_id`, `reason`, `changed_at` | **Append-only**; every transition. |
| `incident_assignments` | `incident_id`, `assigned_user_id`, `assigned_by_user_id`, `assigned_at`, `released_at`, `is_active` | |
| `incident_actions` | `incident_id`, `actor_user_id`, `action_type`, `details`, `action_at` | **Append-only** operational log. |
| `incident_attachments` | `incident_id`, `uploaded_by_user_id`, `file_url`, `file_name`, `mime_type` | |

## 14 · Notifications & Audit

| Table | Key columns | Notes |
|-------|-------------|-------|
| `notification_templates` | `community_id`, `code`, `channel`, `title_template`, `body_template`, `is_active` | |
| `notifications` | `community_id`, `recipient_user_id`, `template_id`, `notification_type`, `title`, `message`, `reference_type`, `reference_id`, `is_read`, `read_at`, `created_at` | Derived from an originating event. |
| `notification_deliveries` | `notification_id`, `channel`, `provider`, `status`, `provider_message_id`, `sent_at`, `delivered_at`, `failed_at`, `failure_reason`, `attempt_count` | **Append-only.** Records mock SMS/WhatsApp + real push/email dispatch. |
| `user_notification_preferences` | `user_id`, `community_id`, `channel`, `event_type`, `is_enabled`, `quiet_hours_start`, `quiet_hours_end` | UQ `(user_id, community_id, channel)` where channel-specific. |
| `audit_logs` | `community_id`, `user_id`, `session_id`, `action`, `module`, `entity_type`, `entity_id`, `old_values` JSONB, `new_values` JSONB, `ip_address` INET, `user_agent`, `created_at` | **Immutable, insert-only.** `REVOKE UPDATE/DELETE`; RLS/trigger protection in staging. Keeps `created_at` only. |

---

## Migration & approval flow (ERD backend note)

```
Requirement → ERD/DB review → model update → migration → local verification
→ code review → production approval (+ backup) → production migration → post-deploy verification
```

- Alembic migrations are the **single source of truth**; never manually alter the deployed
  (Supabase) schema. FastAPI must consume the same approved schema — no competing migration history.
- Test migrations on local PostgreSQL first; commit model + migration together.
- Destructive changes: rollback plan + DB/backend approval + backup confirmation.
- After deploy, verify migration history, columns, FKs, indexes, RLS policies, and the affected
  API/business workflow.

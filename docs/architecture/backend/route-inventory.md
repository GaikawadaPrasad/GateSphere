# Backend Route Inventory

Every registered route, cross-checked against `GET /api/v1/openapi.json` (256 routes total —
230 API routes + `/`, `/healthz`, `/readyz`, `/docs`, `/redoc`, `/docs/oauth2-redirect`,
`/api/v1/openapi.json`). Generated from the source tree; keep in sync with code.

**Legend**
- **Auth**: `session` = `require_auth_async` (opaque `gs_session` cookie + `X-CSRF-Token` on unsafe methods); `public` = none; `session*` = optional (`optional_user`).
- **Perm**: the `require_permission_async("<code>")` gate on the route (resolved against the caller's **effective** per-community permission set — role defaults ± `community_role_permissions` overrides). `platform-admin` = `require_platform_admin` (`is_superadmin`). `–` = session only.
- **Scope**: `T` = tenant-scoped via `TenantScope` (cross-community → 404); `T+U` = also row-level own-unit for a plain resident (`UnitScopedAccess`); `self` = actor's own rows only; `global` = superadmin/global only.
- **Mutation**: primary ORM model(s) written, via `app/modules/<m>/repository.py` → model → PostgreSQL. All mutating routes also insert `audit_logs` in the same transaction unless noted.
- **Side effects**: notification events (`notifications.events.emit*` → SAVEPOINT-isolated), S3/MinIO calls, session revocation, `permission_version` bumps, Celery is **not** invoked synchronously by any route.

---

## ops (`app/main.py`)

| Method | Path | Auth | Perm | Handler | Notes |
|---|---|---|---|---|---|
| GET | `/` | public | – | `root` | service metadata |
| GET | `/healthz` | public | – | `healthz` | liveness |
| GET | `/readyz` | public | – | `readyz` | pings sync `engine` + `redis_client`; `200`/`503` |
| GET | `/docs`, `/redoc`, `/docs/oauth2-redirect`, `/api/v1/openapi.json` | public | – | FastAPI | dev/staging only |
| GET | `/api/v1/<module>/health` (×20) | public | – | `module_health` | per-module liveness |

## auth — `app/modules/auth/`

| Method | Path | Auth | Perm | Service call | Mutation | Side effects |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | public | – (rate-limited `5/min/IP`) | `security.create_session`, `_serialize` | `user_sessions` (insert); Redis `session:*` setex; sets `gs_session`+`gs_csrf` cookies | audit `auth/login.success`; on failure → audit `auth/login.failed` in its own txn, `401 INVALID_CREDENTIALS` |
| POST | `/auth/logout` | session | – | `security.destroy_session` | `user_sessions.revoked_at`; Redis key drop; clears cookies | audit `auth/logout` |
| GET | `/auth/me` | session | – | `_serialize` → `user_permissions_async` | – | returns `CurrentUser {permissions[], permission_version, community_ids[]}` |

## users — `app/modules/users/`

| Method | Path | Auth | Perm | Service call | Mutation | Side effects |
|---|---|---|---|---|---|---|
| GET | `/users` | session | `users:view` | `UserService.list_users` | – | community-scoped caller sees users in their communities + unaffiliated |
| POST | `/users` | session | `users:create` | `create_user` (+ optional `grant_role`) | `users` (insert), `user_roles` (insert if `role_slug`) | `409 EMAIL_TAKEN`; on grant → `invalidate_user_permissions_async` |
| GET | `/users/roles` | session | `users:view` | `list_roles` | – | roles + effective permission codes |
| GET | `/users/{user_id}` | session | `users:view` | `get_user` → `_get_visible` | – | `404` if not visible in scope |
| PATCH | `/users/{user_id}` | session | `users:update` | `update_user` | `users` (update) | deactivation → `revoke_all_user_sessions_async` |
| POST | `/users/{user_id}/roles` | session | `users:update` | `grant_role` | `user_roles` (insert) | `409 GRANT_EXISTS`; `invalidate_user_permissions_async([user])` (bump `permission_version` + revoke sessions) |
| DELETE | `/users/{user_id}/roles/{grant_id}` | session | `users:update` | `revoke_role` | `user_roles` (delete) | `invalidate_user_permissions_async([user])` |

## rbac — `app/modules/rbac/`  (configurable RBAC, FR-02 ext)

| Method | Path | Auth | Perm | Service call | Mutation | Side effects |
|---|---|---|---|---|---|---|
| GET | `/rbac/permissions` | session | `users:view` | `list_permissions` | – | full catalogue |
| GET | `/rbac/roles` | session | `users:view` | `list_roles` | – | per role: current + `default_permissions` + `is_wildcard` |
| PUT | `/rbac/roles/{slug}/permissions` | session | platform-admin | `set_role_permissions` → `_apply_global` | `role_permissions` (diff insert/delete) | `422 ROLE_NOT_EDITABLE`/`UNKNOWN_PERMISSION`; `invalidate_user_permissions_async(all holders)` |
| POST | `/rbac/roles/{slug}/permissions` | session | platform-admin | `add_role_permission` | `role_permissions` (insert) | as above |
| DELETE | `/rbac/roles/{slug}/permissions/{code}` | session | platform-admin | `remove_role_permission` | `role_permissions` (delete) | as above |
| POST | `/rbac/roles/{slug}/permissions/reset` | session | platform-admin | `reset_role_permissions` | `role_permissions` (rebuild to `ROLE_PERMISSIONS`) | as above |
| GET | `/rbac/communities/{cid}/overrides` | session | `users:view` | `list_community_overrides` (scope.require cid) | – | – |
| GET | `/rbac/communities/{cid}/roles/{slug}/effective` | session | `users:view` | `effective_permissions` | – | `defaults ∪ allow − deny` |
| PUT | `/rbac/communities/{cid}/roles/{slug}/permissions` | session | platform-admin | `set_community_role_overrides` | `community_role_permissions` (upsert allow/deny) | `422 CONFLICTING_OVERRIDE`; `invalidate_user_permissions_async(holders in cid)` |
| DELETE | `/rbac/communities/{cid}/roles/{slug}/permissions/{code}` | session | platform-admin | `remove_community_override` | `community_role_permissions` (delete) | as above |

## audit — `app/modules/audit/`  (FR-16, read-only)

| Method | Path | Auth | Perm | Scope | Service call | Notes |
|---|---|---|---|---|---|---|
| GET | `/audit/logs` | session | `audit:view` | T (global caller = all + `community_id IS NULL`) | `AuditQueryService.list_logs` | filters: `module`, `action`, `entity_type`, `entity_id`, `user_id`, `since`, `until`, page |
| GET | `/audit/logs/{log_id}` | session | `audit:view` | T | `get_log` (`_scoped`) | `404` outside scope |
| GET | `/audit/logs.csv` | session | `audit:export` | T | `export_logs` → `StreamingResponse` | CSV stream |

## communities — `app/modules/communities/`  (FR-03 property hierarchy)

| Method | Path | Auth | Perm | Scope | Mutation | Notes |
|---|---|---|---|---|---|---|
| GET | `/communities` | session | `communities:view` | T | – | `?active=` |
| POST | `/communities` | session | `communities:create` | global | `communities` (insert) | `403 GLOBAL_ONLY` if not superadmin; `409 COMMUNITY_CODE_TAKEN` |
| GET | `/communities/{cid}` | session | `communities:view` | T | – | |
| PATCH | `/communities/{cid}` | session | `communities:update` | T | `communities` (update) | old/new snapshot in audit |
| DELETE | `/communities/{cid}` | session | `communities:delete` | global | `communities` (hard delete, cascades) | `403 GLOBAL_ONLY` |
| GET/POST | `/communities/{cid}/gates` | session | `communities:view` / `:create` | T | `gates` (insert) | `409 GATE_CODE_TAKEN` |
| GET/POST | `/communities/{cid}/towers` | session | `:view` / `:create` | T | `towers` (insert) | `409 TOWER_NAME_TAKEN` |
| GET/PATCH | `/communities/towers/{tower_id}` | session | `:view` / `:update` | T | `towers` (update) | |
| GET | `/communities/towers/{tower_id}/floors` | session | `:view` | T | – | |
| POST | `/communities/floors` | session | `:create` | T (tower must be in scope) | `floors` (insert), `towers.total_floors` (update) | `409 FLOOR_NUMBER_TAKEN` |
| GET | `/communities/floors/{floor_id}` , `/floors/{floor_id}/units` | session | `:view` | T | – | |
| POST | `/communities/units` | session | `:create` | T (floor must be in scope) | `units` (insert) | `409 UNIT_NUMBER_TAKEN` |
| GET/PATCH | `/communities/units/{unit_id}` | session | `:view` / `:update` | T | `units` (update) | |

## onboarding — `app/modules/onboarding/`  (FR-03 tenant lifecycle)

| Method | Path | Auth | Perm | Scope | Service call | Mutation | Side effects |
|---|---|---|---|---|---|---|---|
| POST | `/communities/{cid}/invitations` | session | `residents:create` | T | `create_invitation` | `community_invitations` (insert) | returns `token`+`accept_url` once; `409 INVITATION_EXISTS`/`PRIMARY_OCCUPANT_EXISTS` |
| GET | `/communities/{cid}/invitations` | session | `residents:view` | T | `list_invitations` | – | `?invite_status=` |
| POST | `/communities/{cid}/invitations/{id}/revoke` | session | `residents:create` | T | `revoke_invitation` | `community_invitations.status='revoked'` | `422 INVITATION_NOT_PENDING` |
| GET | `/invitations/{token}` | **public** | – | – | `public_view` | `community_invitations.status='expired'` (lazy) | community name, `Tower/Floor/Unit` label, `account_exists` |
| POST | `/invitations/{token}/accept` | **public** (`session*`) | – | – (`FOR UPDATE` on invite) | `accept` | `users` (insert if new), `user_sessions` (insert), `resident_profiles` (upsert, active), `unit_occupancies` (insert), `emergency_contacts` (insert), `user_roles` (grant `resident`@cid) | `409 PHONE_TAKEN`; `422 PASSWORD_REQUIRED`; `403 LOGIN_REQUIRED`; `invalidate_user_permissions_async`; emit `onboarding.invitation_accepted` → inviter |
| POST | `/communities/{cid}/tenants` | session | `residents:create` | T | `add_tenant` | `users` (insert if new), `resident_profiles`, `unit_occupancies`, `user_roles` grant | `409 OCCUPANCY_EXISTS`/`PRIMARY_OCCUPANT_EXISTS`; `409 PHONE_TAKEN`; `invalidate_user_permissions_async` |
| DELETE | `/communities/{cid}/tenants/{profile_id}` | session | `residents:delete` | T | `remove_tenant` | `unit_occupancies` (bulk `is_active=false`), `resident_profiles.status='moved_out'`, `user_roles` (delete `resident`@cid) | `invalidate_user_permissions_async` |
| DELETE | `/communities/{cid}/units/{unit_id}/occupants/{occupancy_id}` | session | `residents:delete` | T | `remove_occupancy` | `unit_occupancies` (end); if last → `resident_profiles.moved_out` + grant delete | `invalidate_user_permissions_async` (conditional) |

## residents — `app/modules/residents/`  (FR-03)

| Method | Path | Auth | Perm | Scope | Mutation | Notes |
|---|---|---|---|---|---|---|
| GET/POST | `/residents` | session | `residents:view` / `:create` | T | `resident_profiles` (insert) | `409 PROFILE_EXISTS` |
| GET/PATCH | `/residents/{profile_id}` | session | `:view` / `:update` | T | `resident_profiles` (update) | |
| GET/POST | `/residents/{profile_id}/emergency-contacts` | session | `:view` / `:create` | T | `emergency_contacts` (insert) | |
| DELETE | `/residents/emergency-contacts/{contact_id}` | session | `residents:delete` | T | `emergency_contacts` (delete) | `204` |
| GET | `/residents/units/{unit_id}/occupancies`, `/family-members` | session | `:view` | T | – | |
| POST | `/residents/occupancies` | session | `:create` | T | `unit_occupancies` (insert) | `409 PRIMARY_OCCUPANT_EXISTS` (partial-unique index); `409 OCCUPANCY_EXISTS` |
| PATCH | `/residents/occupancies/{occupancy_id}/end` | session | `:update` | T | `unit_occupancies` (end) | `422 INVALID_DATE_RANGE` |
| POST | `/residents/family-members` | session | `:create` | T | `family_members` (insert) | |
| GET/POST | `/residents/move-records` | session | `:view` / `:create` | T | `move_records` (insert) | status = `scheduled`/`requested` |
| GET | `/residents/move-records/{move_id}` | session | `:view` | T | – | |
| PATCH | `/residents/move-records/{move_id}/status` | session | `:update` | T (state machine) | `move_records.status` (+ `unit_occupancies` on `completed` move_out) | `422 INVALID_TRANSITION` |

## visitors — `app/modules/visitors/`  (FR-04)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals / side effects |
|---|---|---|---|---|---|---|
| GET/PATCH | `/visitors/policy` | session | `visitors:view` / `:update` | T | `visitor_policies` (upsert) | config-as-data |
| GET | `/visitors` | session | `visitors:view` | T | – | visitor directory |
| GET/POST | `/visitors/blacklist` | session | `:view` / `:approve` | T | `visitor_blacklist` (insert) | phone/id stored as HMAC digest |
| GET | `/visitors/requests` | session | `visitors:view` | T+U | – | plain resident → own units + own-created |
| POST | `/visitors/requests` | session | `visitors:create` | T+U | `visitors` (upsert), `visitor_requests` (insert), `visitor_request_members` (insert) | **blacklist screen** → `403 VISITOR_BLACKLISTED` (audit `request.blacklisted`); `_primary_host` set; if approval needed → emit `visitor.approval_needed` → host |
| GET | `/visitors/requests/{id}` | session | `visitors:view` | T+U | – | `404` if not caller's unit |
| POST | `/visitors/requests/{id}/decision` | session | `visitors:approve` | T+U | `visitor_approvals` (insert), `visitor_requests.status` | `422` if not `pending`; `409 ALREADY_DECIDED`; emit `visitor.{approved\|rejected}` → creator |
| POST | `/visitors/requests/{id}/cancel` | session | `visitors:update` | T+U | `visitor_requests.status='cancelled'` | `422 INVALID_TRANSITION` |
| GET/POST | `/visitors/requests/{id}/members` | session | `:view` / `:create` | T+U | `visitor_request_members` (insert) | blacklist screen; `409 MEMBER_EXISTS` |
| POST | `/visitors/requests/{id}/passes` | session | `visitors:create` | T+U | `visitor_passes` (insert; QR token + optional 6-digit PIN, both HMAC) | pre-approves a `pending` request; `422 INVALID_DATE_RANGE` |
| POST | `/visitors/passes/{pass_id}/revoke` | session | `visitors:update` | T (via request) | `visitor_passes.is_revoked` | |
| GET | `/visitors/entries` | session | `visitors:view` | T+U (via request unit) | – | |
| POST | `/visitors/entries` | session | `visitors:create` | T (via request) | `visitor_entries` (insert), `visitor_requests.status='entered'`, `visitors.visit_count`/`frequent_visitor_flag` | resolves by `request_id` \| `pass_token` \| `pin` (PIN search scoped to guard's community); blacklist re-check → `denied` entry + `403`; `409 ALREADY_INSIDE`; `422 NOT_APPROVED`/`NOT_IN_GROUP` |
| PATCH | `/visitors/entries/{entry_id}/exit` | session | `visitors:update` | T | `visitor_entries.status='exited'`; request → `completed` if last | `422 NOT_INSIDE` |

## gate — `app/modules/gate/`  (FR-05)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals |
|---|---|---|---|---|---|---|
| GET/POST | `/gate/events` | session | `gate:view` / `:create` | T | `gate_events` (append-only insert) | `422 INVALID_ENUM` |
| POST | `/gate/checkpoint-override` | session | `gate:approve` (Security Supervisor / Community Admin) | T | `gate_events` (`checkpoint_override`, reason in metadata) | `reason` 3–500 chars; emit `gate.checkpoint_override` → supervisors + admin |
| GET/POST | `/gate/rosters` | session | `:view` / `:create` | T | `guard_rosters` (insert) | `422 INVALID_TIME_RANGE`; `409 ROSTER_EXISTS` |
| PATCH | `/gate/rosters/{id}` | session | `gate:update` | T | `guard_rosters` (details only) | status is a separate endpoint |
| POST | `/gate/rosters/{id}/status` | session | `gate:update` | T (state machine `planned→active→completed`/`cancelled`) | `guard_rosters.status` | `422 INVALID_TRANSITION` |
| GET/POST | `/gate/assignments` | session | `:view` / `:create` | T | `gate_assignments` (insert) | `409 ASSIGNMENT_ACTIVE` (one active per guard) |
| POST | `/gate/assignments/{id}/end` | session | `gate:update` | T | `gate_assignments.status='ended'` | `422 ALREADY_ENDED` |
| GET | `/gate/alerts` | session | `gate:view` | T | – | |
| POST | `/gate/alerts` | session | **session only** | T | `panic_alerts` (insert) | any role may raise; emit `gate.panic_alert` (`in_app`+`sms`) → supervisors + guards + admin |
| POST | `/gate/alerts/{id}/acknowledge` | session | `gate:update` | T (machine) | `panic_alerts.status='acknowledged'` | `422 INVALID_TRANSITION` |
| POST | `/gate/alerts/{id}/resolve` | session | `gate:update` | T (machine) | `panic_alerts.status='resolved'` + summary | |
| POST | `/gate/alerts/{id}/cancel` | session | **raiser only** | T | `panic_alerts.status='cancelled'` | `403 NOT_ALERT_OWNER` |

## domestic_staff — `app/modules/domestic_staff/`  (FR-06)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals |
|---|---|---|---|---|---|---|
| GET/POST | `/domestic-staff` | session | `domestic_staff:view` / `:create` | T | `domestic_staff` (insert; id# HMAC) | `409 STAFF_EXISTS` (one per phone/community); `photo_url` → `ensure_confirmed` |
| GET/PATCH | `/domestic-staff/{staff_id}` | session | `:view` / `:update` | T | `domestic_staff` (update) | `police_verification_status` state machine (`ensure_transition`) |
| GET/POST | `/domestic-staff/assignments` | session | `:view` / `:approve` | T | `staff_unit_assignments` (insert) | `409 ASSIGNMENT_EXISTS` (one active per staff+unit); `422 INVALID_DATE_RANGE` |
| POST | `/domestic-staff/assignments/{id}/end` | session | `:update` | T | `staff_unit_assignments.is_active=false` | `422 ALREADY_ENDED` |
| GET | `/domestic-staff/attendance` | session | `:view` | T | – | |
| POST | `/domestic-staff/attendance/check-in` | session | `:create` | T | `staff_attendance` (insert, `inside`) | `409 ALREADY_INSIDE` (one open row) |
| PATCH | `/domestic-staff/attendance/{id}/check-out` | session | `:update` | T | `staff_attendance` (`check_out_at`, `left`) | `422 NOT_INSIDE` |
| POST | `/domestic-staff/ratings` | session | `:create` | T | `staff_ratings` (upsert: one per staff+unit+resident) | |
| GET | `/domestic-staff/{staff_id}/ratings` | session | `:view` | T | – | |

## deliveries — `app/modules/deliveries/`  (FR-07)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals |
|---|---|---|---|---|---|---|
| GET/PUT | `/deliveries/protocols` | session | `deliveries:view` / `:approve` | T | `delivery_protocols` (upsert per delivery_type) | config-as-data (`Allow at gate` / `Approval required` / `Leave at desk` / `Reject`) |
| GET | `/deliveries` | session | `deliveries:view` | T+U | – | plain resident → own units |
| POST | `/deliveries` | session | `deliveries:create` | T+U | `deliveries` (insert), `delivery_events` (`logged`) | protocol decides `auto_approved` vs `pending`; `_primary_resident` set |
| GET | `/deliveries/{id}` | session | `deliveries:view` | T+U | – | `404` if not caller's unit |
| POST | `/deliveries/{id}/decision` | session | `deliveries:approve` | T+U | `deliveries.approval_status`, `delivery_events` (insert) | `422 INVALID_TRANSITION` if not `pending` |
| POST | `/deliveries/{id}/arrival` | session | `deliveries:update` | T | `deliveries.status='at_gate'`, `delivery_events` (`arrived`) | `422 NOT_APPROVED`/`INVALID_TRANSITION` |
| POST | `/deliveries/{id}/delivered` | session | `deliveries:update` | T | `deliveries.status` (`delivered`/`collected` per protocol), `delivery_events` | `422 INVALID_TRANSITION` |
| POST | `/deliveries/{id}/cancel` | session | `deliveries:update` | T | `deliveries.status='cancelled'`, `delivery_events` | |
| GET | `/deliveries/{id}/events` | session | `deliveries:view` | T+U (via get_delivery) | – | append-only log |

## vehicles — `app/modules/vehicles/`  (FR-08)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals |
|---|---|---|---|---|---|---|
| GET/PATCH | `/vehicles/parking/rules` | session | `vehicles:view` / `:update` | T | `parking_rules` (upsert) | config-as-data |
| GET/POST | `/vehicles` | session | `vehicles:view` / `:create` | T | `vehicles` (insert) | owner = resident XOR visitor (DB CHECK); `409 VEHICLE_EXISTS` |
| GET/PATCH | `/vehicles/{vehicle_id}` | session | `:view` / `:update` | T | `vehicles` (update) | |
| GET/POST | `/vehicles/parking/slots` | session | `:view` / `:create` | T | `parking_slots` (insert) | `409 SLOT_EXISTS` |
| GET/POST | `/vehicles/parking/allocations` | session | `:view` / `:create` | T | `parking_allocations` (insert), `parking_slots.status='allocated'` | `409 SLOT_TAKEN`/`VEHICLE_HAS_SLOT`; `422 UNIT_SLOT_LIMIT` (`parking_rules.max_active_slots_per_unit`) |
| POST | `/vehicles/parking/allocations/{id}/release` | session | `:update` | T | `parking_allocations.status='released'`, `parking_slots.status='available'` | `422 ALREADY_RELEASED` |
| GET/POST | `/vehicles/entries` | session | `:view` / `:create` | T | `vehicle_entries` (insert; `is_flagged` if plate unknown) | `409 ALREADY_INSIDE` (one open per plate) |
| PATCH | `/vehicles/entries/{id}/exit` | session | `:update` | T | `vehicle_entries.status='exited'` | `422 NOT_INSIDE` |
| GET/POST | `/vehicles/parking/violations` | session | `:view` / `:create` | T | `parking_violations` (insert) | `evidence_url` → `ensure_confirmed` |
| POST | `/vehicles/parking/violations/{id}/status` | session | `:update` | T (machine `open→acknowledged→resolved`/`waived`) | `parking_violations.status` | `422 INVALID_TRANSITION` |

## billing — `app/modules/billing/`  (FR-09)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals / side effects |
|---|---|---|---|---|---|---|
| GET/POST/PATCH | `/billing/charge-heads` | session | `billing:view` / `:approve` / `:approve` | T | `charge_heads` (insert/update) | `409 CHARGE_HEAD_EXISTS` |
| GET/PATCH | `/billing/rules` | session | `:view` / `:approve` | T | `billing_rules` (upsert) | config-as-data |
| GET | `/billing/invoices` | session | `billing:view` | T+U | – | plain resident → own units only |
| POST | `/billing/invoices` | session | `billing:create` | T (staff) | `maintenance_invoices` + `invoice_items` (insert) | **`403 STAFF_ONLY`** for a unit-restricted caller; server-computed subtotal/tax/total |
| GET | `/billing/invoices/{id}` | session | `billing:view` | T+U | – | `404` if not caller's unit |
| POST | `/billing/invoices/{id}/post` | session | `billing:approve` | T | `maintenance_invoices.status='posted'`, `ledger_entries` (debit) | emit `billing.invoice_posted` → billed user |
| POST | `/billing/invoices/{id}/cancel` | session | `billing:approve` | T | `maintenance_invoices.status='cancelled'`, `ledger_entries` (credit if posted) | `422 INVOICE_HAS_PAYMENTS` |
| GET | `/billing/payments` | session | `billing:view` | T+U → `self` (payer) | – | plain resident → own payments |
| POST | `/billing/payments` | session | `billing:create` | T (allocations must reference visible units) | `payments` + `payment_allocations` (insert), `maintenance_invoices.amount_paid`/`status`, `ledger_entries` (credit per allocation) | `422 ALLOCATION_MISMATCH`/`OVER_ALLOCATION`/`INVOICE_NOT_PAYABLE`; `payer_user_id` forced to actor for unit-restricted callers; simulated gateway |
| GET | `/billing/payments/{id}`, `/{id}/receipt` | session | `billing:view` | T+U → `self` | – | `404` if not caller's payment |
| GET | `/billing/units/{unit_id}/ledger` | session | `billing:view` | T+U | – | `404` if not caller's unit |

## complaints — `app/modules/complaints/`  (FR-10)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals / side effects |
|---|---|---|---|---|---|---|
| GET/POST/PATCH | `/complaints/categories` | session | `complaints:view` / `:approve` / `:approve` | T | `service_categories` (insert/update) | `409 CATEGORY_EXISTS` |
| GET/PUT | `/complaints/sla` | session | `:view` / `:approve` | T | `sla_policies` (upsert per category+priority) | config-as-data |
| GET | `/complaints/tickets` | session | `complaints:view` | T+U | – | plain resident → own units + own-raised |
| POST | `/complaints/tickets` | session | `complaints:create` | T+U | `service_tickets` (insert), `ticket_status_history` (`created`) | SLA clocks stamped from `sla_policies` |
| GET | `/complaints/tickets/{id}` | session | `complaints:view` | T+U | – | `404` if not caller's unit |
| POST | `/complaints/tickets/{id}/assign` | session | `complaints:update` | T | `ticket_assignments` (insert), `service_tickets.status='assigned'`, history | assignee must be a community member (`user_in_community`) else `404`; `vendor_name` XOR user |
| POST | `/complaints/tickets/{id}/transition` | session | `complaints:update` | T (machine `created..resolved`) | `service_tickets.status`, `ticket_status_history` | `resolved` → `resident_confirmation`; emit `ticket.<status>` → raiser; `closed`/`reopened` blocked here |
| POST | `/complaints/tickets/{id}/confirm` | session | `complaints:view` | T+U | `service_tickets.status` (`closed` / `reopened`), history | only from `resident_confirmation`; `confirmed`→closed, `disputed`→reopened |
| GET/POST | `/complaints/tickets/{id}/messages` | session | `complaints:view` | T+U | `ticket_messages` (insert) | **internal notes hidden from residents**; resident cannot post `is_internal` (`403 INTERNAL_NOTE_FORBIDDEN`) |
| POST | `/complaints/tickets/{id}/feedback` | session | `complaints:view` | T+U | `ticket_feedback` (insert) | `422 TICKET_NOT_CLOSED`; `409 FEEDBACK_EXISTS` |
| GET/POST | `/complaints/tickets/{id}/attachments` | session | `complaints:view` | T+U | `ticket_attachments` (insert) | `file_url` → `ensure_confirmed` |
| GET | `/complaints/tickets/{id}/history` | session | `complaints:view` | T+U | – | |

## amenities — `app/modules/amenities/`  (FR-11)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals |
|---|---|---|---|---|---|---|
| GET/POST | `/amenities` | session | `amenities:view` / `:approve` | T | `amenities` (insert) | `409 AMENITY_EXISTS` |
| GET | `/amenities/{amenity_id}` | session | `amenities:view` | T | – | cross-tenant → `404` |
| PATCH | `/amenities/{amenity_id}` | session | `amenities:update` | T | `amenities` (update) | |
| GET/POST | `/amenities/{amenity_id}/slots` | session | `:view` / `:create` | T | `amenity_slots` (insert) | `422 INVALID_TIME_RANGE` |
| DELETE | `/amenities/slots/{slot_id}` | session | `amenities:delete` | T | `amenity_slots.is_active=false` | soft |
| GET/PUT | `/amenities/{amenity_id}/rules` | session | `:view` / `:update` | T | `amenity_rules` (upsert) | config-as-data |
| GET/POST | `/amenities/{amenity_id}/blocks` | session | `:view` / `:create` | T | `amenity_blocks` (insert) | maintenance window; `422 INVALID_TIME_RANGE` |
| GET | `/amenities/bookings` | session | `amenities:view` | T → `self` (resident) | – | plain resident → own bookings; `?mine=` |
| POST | `/amenities/bookings` | session | `amenities:create` | T | `amenity_bookings` (insert, `confirmed`) | **atomic**: `SELECT … FOR UPDATE` on amenity → block overlap + capacity check; `409 AMENITY_BLOCKED`/`SLOT_FULL`; `422 TOO_FAR_AHEAD`/`TOO_LONG`/`UNIT_BOOKING_LIMIT`/`SLOT_WEEKDAY_MISMATCH`/`DATE_IN_PAST`; `_actor_unit` required |
| GET | `/amenities/bookings/{id}` | session | `amenities:view` | T → `self` | – | `404` if not caller's booking |
| POST | `/amenities/bookings/{id}/cancel` | session | `amenities:view` | owner OR `amenities:update` | `amenity_bookings.status='cancelled'` | `403 NOT_BOOKING_OWNER`; `422 TOO_LATE_TO_CANCEL` (`min_cancel_hours`) |
| POST | `/amenities/bookings/{id}/status` | session | `amenities:update` | T | `amenity_bookings.status` (`completed`/`no_show`) | |

## communication — `app/modules/communication/`  (FR-12)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals |
|---|---|---|---|---|---|---|
| GET | `/communication/announcements` | session | `communication:view` | T | – | `?published_only=` |
| POST | `/communication/announcements` | session | `communication:create` | T | `announcements` + `announcement_targets` (insert) | targets validated against community (`_validate_targets`) |
| GET/PATCH | `/communication/announcements/{id}` | session | `:view` / `:update` | T | `announcements` (update) | `409 ALREADY_PUBLISHED` (published = immutable) |
| POST | `/communication/announcements/{id}/publish` | session | `communication:approve` | T | `announcements.is_published=true` | freezes |
| POST | `/communication/announcements/{id}/expire` | session | `communication:approve` | T | `announcements` (expire) | |
| GET/POST | `/communication/groups` | session | `:view` / `:create` | T | `resident_groups` (insert) | `409 GROUP_EXISTS` |
| PATCH | `/communication/groups/{id}` | session | `communication:update` | T | `resident_groups` (update) | |
| GET/POST | `/communication/groups/{id}/members` | session | `:view` / `:update` | T | `resident_group_members` (insert) | user must be a community member (`user_in_community`) else `404`; `409 MEMBER_EXISTS` |
| DELETE | `/communication/groups/{id}/members/{member_id}` | session | `communication:update` | T | `resident_group_members` (delete) | checks `member.group_id == group.id` |
| POST | `/communication/polls` | session | `communication:create` | T | `polls` + `poll_options` (insert) | announcement must be type `poll`/`survey`; `409 POLL_EXISTS` |
| GET | `/communication/polls/{id}`, `/{id}/results` | session | `communication:view` | T | – | live tally |
| POST | `/communication/polls/{id}/status` | session | `communication:update` | T (machine `draft→open→closed`) | `polls.status` | `open` requires published announcement |
| POST | `/communication/polls/{id}/vote` | session | `communication:view` | T | `poll_responses` + `poll_response_options` (insert) | `422 POLL_NOT_OPEN`/`INVALID_OPTION`/`SINGLE_CHOICE_ONLY`; `409 ALREADY_VOTED` |

## incidents — `app/modules/incidents/`  (FR-13)

| Method | Path | Auth | Perm | Scope | Mutation | Conditionals / side effects |
|---|---|---|---|---|---|---|
| GET/POST | `/incidents` | session | `incidents:view` / `:create` | T | `security_incidents` (insert), `incident_status_history` (`reported`) | `_belongs` checks on tower/unit/gate/panic_alert refs |
| GET/PATCH | `/incidents/{id}` | session | `:view` / `:update` | T | `security_incidents` (update) | `422 INVALID_TRANSITION` if `closed`/`false_alarm` |
| POST | `/incidents/{id}/transition` | session | `incidents:update` | T (machine `reported..closed`) | `security_incidents.status`, `incident_status_history` | `resolved` needs `resolution_summary`; emit `incident.<status>` → reporter |
| GET/POST | `/incidents/{id}/assignments` | session | `:view` / `:update` | T | `incident_assignments` (insert) | responder must be community member (`user_in_community`) else `404`; `409 ALREADY_ASSIGNED` |
| POST | `/incidents/assignments/{assignment_id}/release` | session | `incidents:update` | T (via `get_incident`) | `incident_assignments.is_active=false` | `422 ALREADY_RELEASED` |
| GET/POST | `/incidents/{id}/actions` | session | `:view` / `:update` | T | `incident_actions` (insert) | append-only |
| GET/POST | `/incidents/{id}/attachments` | session | `:view` / `:update` | T | `incident_attachments` (insert) | `file_url` → `ensure_confirmed` |
| GET | `/incidents/{id}/history` | session | `incidents:view` | T | – | |

## dashboards — `app/modules/dashboards/`  (FR-14, read-only aggregates)

| Method | Path | Auth | Perm | Scope | Service | Notes |
|---|---|---|---|---|---|---|
| GET | `/dashboards/overview` | session | `dashboards:view` | T | `overview` | cross-module counts |
| GET | `/dashboards/security` | session | `dashboards:view` | T | `security` | visitors/vehicles/staff inside, pending approvals, **expected visitors** (approved+valid+not entered), active panic alerts, open incidents, on-duty guards |
| GET | `/dashboards/financial` | session | `dashboards:view` | T | `financial` | invoices by status, billed/collected/outstanding |
| GET | `/dashboards/resident` | session | `dashboards:view` | `self` (actor's occupancy) | `resident` | my tickets/requests/bookings/dues |

## notifications — `app/modules/notifications/`  (FR-15)

| Method | Path | Auth | Perm | Scope | Mutation | Notes |
|---|---|---|---|---|---|---|
| GET | `/notifications` | session | `notifications:view` | `self` (recipient) | – | inbox; `?unread_only=` |
| GET | `/notifications/{id}` | session | `notifications:view` | `self` | – | `404` if not recipient |
| POST | `/notifications/{id}/read` | session | `notifications:view` | `self` | `notifications.is_read` | |
| POST | `/notifications/read-all` | session | `notifications:view` | `self` | `notifications.is_read` (bulk) | returns count |
| GET/PUT | `/notifications/me/preferences` | session | `notifications:view` | `self` | `user_notification_preferences` (upsert) | per channel; quiet hours |
| GET/PUT | `/notifications/templates` | session | `notifications:create` | T | `notification_templates` (upsert) | per code+channel (both GET and PUT are `:create`-gated) |
| POST | `/notifications/dispatch` | session | `notifications:create` | T | `notifications` (insert), `notification_deliveries` (one per channel) | `in_app` always delivered; other channels **simulated** (`delivered`/`skipped` by preference + quiet hours); `404 Recipient not found` / `Template not found`; `422 CONTENT_REQUIRED` |

## uploads — `app/modules/uploads/`  (file pipeline, NFR-SEC-07)

| Method | Path | Auth | Perm | Scope | Mutation | Notes / integration |
|---|---|---|---|---|---|---|
| GET | `/uploads/kinds` | session | – | – | – | fixed catalogue (`catalogue.py`) |
| POST | `/uploads` | session | – | T (community-scoped kinds) | `managed_files` (insert, `pending`) | → `storage.presigned_put` (S3/MinIO); returns `upload_url` + `file_url` + `confirm_url` |
| POST | `/uploads/{file_id}/confirm` | session | – | creator OR community member (`_assert_can_access`) | `managed_files.status` (`confirmed`/`rejected`) | → `storage.object_head` + `object_bytes` (magic-byte `sniff.detect`); reject → `storage.delete_object`; `422 UPLOAD_REJECTED`/`NO_OBJECT` |
| GET | `/uploads/download?key=` | session | – | via `managed_files` row (`_assert_can_access`, must be `confirmed`) | – | → `storage.presigned_get` (1h); `404` for unknown key / unconfirmed / out-of-scope — **not** a blind presign |

---

## Background jobs (Celery beat — `app/core/celery_app.py`)

Not invoked by any HTTP route. Each task uses `app/core/jobs.py` (`job_session` async ctx +
global `system_scope` + seeded `system@` audit actor).

| Task | Cadence | Module | Effect | Events |
|---|---|---|---|---|
| `sweep_ticket_sla` | 5 min | complaints | advance `service_tickets.escalation_state` (`on_track→at_risk→breached→escalated`), stamp, audit | `complaints.ticket_<state>` → resident + escalation role |
| `sweep_overdue_invoices` | daily 01:00 | billing | `posted`/`partially_paid` past `due_date` → `overdue` | `billing.invoice_overdue` → billed user |
| `send_dues_reminders` | Mon 09:00 | billing | every invoice with a balance | `billing.dues_reminder` → billed user |
| `expire_stale_requests` | 15 min | visitors | `pending`/`approved` past `valid_until` → `expired` | `visitors.request_expired` → creator |
| `close_past_amenity_bookings` | 15 min | amenities | `confirmed` past `end_at` → `completed` | – |

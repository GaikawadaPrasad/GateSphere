# Module: Visitor Management (FR-04)

> Canonical spec for the `visitors` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Visitor directory, blacklist screening, host-approval workflow, digital passes (QR / PIN / OTP),
and gate entry / exit stamping with a permanent audit trail. Sits on `communities` (gates, units)
and `residents` (primary occupant → host resolution).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View (directory, requests, entries, blacklist, policy) | `visitors:view` | Super Admin, Community Admin, Facility Manager, Association Committee, Security Supervisor, Security Guard (scoped), Auditor |
| Create request / record gate entry / issue pass | `visitors:create` | Super Admin, Community Admin, Security Supervisor, Security Guard |
| Approve / reject a request | `visitors:approve` | Super Admin, Community Admin, **Resident** (own unit as host), Security Supervisor |
| Update (policy, blacklist add, cancel request, record exit, revoke pass) | `visitors:update` | Super Admin, Community Admin, Security Supervisor; Security Guard has entry/exit + blacklist view |

## Data model

Owned tables (`docs/database/schema.md §04`), migration `0007`. Tenant-scoped tables carry
`community_id` + RLS: `visitors`, `visitor_blacklist`, `visitor_requests`, `visitor_entries`,
`visitor_policies`. `visitor_approvals` and `visitor_passes` are reached only through their parent
request (no direct tenant column).

| Table | Notes |
|-------|-------|
| `visitors` | UQ `(community_id, phone)` — one record per phone per community. UQ `(id, community_id)` (composite FK target). `id_number_hash` = HMAC (`app.core.hashing.digest`), never plaintext. `visit_count` / `frequent_visitor_flag` (auto-set at ≥ 5 visits). |
| `visitor_blacklist` | `phone_hash` + optional `id_number_hash` (both HMAC, indexed). `risk_level` ∈ low·medium·high. `active_from` / `active_until` (dates), `is_active`. |
| `visitor_policies` | UQ `(community_id)` — one row per community, auto-created on first read with `_DEFAULT_POLICY`. `blacklist_mode` ∈ block·warn. `pass_ttl_minutes` default 240. |
| `visitor_requests` | FK `(visitor_id, community_id) → visitors`, `(unit_id, community_id) → units`. UQ `(id, community_id)`. `status` ∈ pending·approved·rejected·cancelled·expired·entered·completed. `visitor_type` ∈ personal_guest·relative·cab_taxi·delivery_exec·service_tech·vendor·interviewee·event_guest·recurring. |
| `visitor_approvals` | UQ `(request_id, approver_user_id)` — one decision per approver. `decision` ∈ approved·rejected. |
| `visitor_passes` | `token_hash` UQ (HMAC of a `secrets.token_urlsafe(18)` shown once). `pass_type` ∈ qr·pin·otp. `max_entries` / `entry_count`, `is_revoked`. |
| `visitor_entries` | FK `(visitor_id, community_id) → visitors`. `status` ∈ inside·exited·denied. `gate_id → gates` (SET NULL). Denied blacklist attempts are recorded here too. |

Migration `0007` also renames the `audit_logs` indexes orphaned by `0005`'s column rename
(`ix_audit_logs_at → ix_audit_logs_created_at`, `..._actor_user_id → ..._user_id`).

## Business rules (service layer)

- Everything is created in the caller's **active community** — a single-community non-global
  `TenantScope`, or an explicit `?community_id=` for a global caller (`COMMUNITY_REQUIRED` otherwise).
- `unit_id`, `visitor_id`, `gate_id` are all resolved **within scope** — a cross-tenant reference
  is a `404`, never a `403`.
- **Request creation**: supply `visitor` (upserted by phone) or `visitor_id`. Blacklist is screened
  before the request is usable; a hit under `blacklist_mode="block"` → `403 VISITOR_BLACKLISTED`
  (audited, no request row). `visitor_type="recurring"` skips approval; otherwise the policy's
  `approval_required` decides `pending` vs `approved`.
- Host = the unit's primary active occupant's user (`residents.UnitOccupancy` → `ResidentProfile`).
- **Decision**: only on a `pending` request (`422 INVALID_TRANSITION`); one decision per approver
  (`409 ALREADY_DECIDED`). Sets status `approved` / `rejected`.
- **Cancel**: only `pending` / `approved` → `cancelled`.
- **Pass**: only for `approved` / `pending` requests; issuing a pass pre-approves a pending one.
  `valid_to` defaults to `now + policy.pass_ttl_minutes`; must be after `valid_from`
  (`422 INVALID_DATE_RANGE`). Token returned once in `PassRead.token`.
- **Gate entry**: by `pass_token` or `request_id`. Pass checks → `PASS_REVOKED` / `PASS_EXPIRED` /
  `PASS_EXHAUSTED`. Request must be `approved` / `entered` (`422 NOT_APPROVED`). Blacklist is
  re-checked at the gate — a hit records a `denied` entry and raises `403 VISITOR_BLACKLISTED`.
  `409 ALREADY_INSIDE` if the visitor has an open entry. On success: request → `entered`,
  `visit_count++`, `last_visit_at`, `frequent_visitor_flag` at ≥ 5.
- **Gate exit**: entry must be `inside` (`422 NOT_INSIDE`); sets `exited`, and a still-`entered`
  request → `completed`.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/visitors`. Full contract: [`docs/backend/api/visitors.md`](../../api/visitors.md).
Static-prefix routes (`/health`, `/policy`, `/blacklist`, `/entries`, `/requests`, `/passes`) are
declared **before** the `GET ""` directory list.

## Events

Audit only for now (`audit_logs`, same transaction): `policy.update`, `blacklist.add`,
`request.create`, `request.blacklisted`, `request.approved` / `request.rejected`, `request.cancel`,
`pass.create`, `pass.revoke`, `entry.create`, `entry.denied`, `entry.exit`. Async notification
fan-out (host push / SMS) lands with FR-15.

## Seed

`seed_visitors()` — one `VisitorPolicy` per community + three sample visitors each.

## Tests

`app/modules/visitors/tests/test_visitors_unit.py` (service lifecycle: recurring bypass, approval,
double-decision conflict, blacklist block, entry gating, full entry/exit, pass issue+exhaust,
revoked pass) and `test_visitors_api.py` (health, auth gate, guard→resident approve flow,
resident cannot manage blacklist, supervisor blacklist blocks a request, cross-community unit 404).

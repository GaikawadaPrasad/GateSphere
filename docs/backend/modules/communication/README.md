# Module: Communication & Broadcasts (FR-12)

> Canonical spec for the `communication` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Community announcements with scoped targets (tower / unit / role / all), and polls
(options + one response per user + live tally). Sits on `communities` (towers, units) and
`users` (roles).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View announcements / polls · vote | `communication:view` | Resident, Association Committee, Community Admin, Super Admin, Auditor |
| Create draft announcement / poll | `communication:create` | Community Admin, Association Committee, Super Admin |
| Edit draft · expire announcement | `communication:update` | Community Admin, Association Committee, Super Admin |
| Publish announcement · open/close poll | `communication:approve` | Community Admin, Association Committee, Super Admin |

## Data model

Owned tables (`docs/database/schema.md §12`), migration `0015`. `announcements` and `polls`
are tenant-scoped + RLS; the rest are reached only through their parent.

| Table | Notes |
|-------|-------|
| `announcements` | UQ `(id, community_id)`. `announcement_type` ∈ notice·emergency·poll·event·survey; `priority` ∈ low·normal·high·urgent. `is_published` — **permanent record once true**. |
| `announcement_targets` | `CHECK target_all_community OR tower_id OR unit_id OR role_id`. Targets validated against the announcement's community. |
| `polls` | UQ `announcement_id` — 1:1 with its announcement. `status` ∈ draft·open·closed. `allow_multiple` gates multi-option selection. |
| `poll_options` | `display_order` for stable rendering. |
| `poll_responses` | UQ `(poll_id, user_id)` — one response per user. |
| `poll_response_options` | UQ `(response_id, option_id)`. |

## Business rules (service layer)

- Scoped to the caller's **active community**. Cross-tenant tower / unit target → `404`.
- **Announcement**: editable only while `is_published = false`
  (`422 ALREADY_PUBLISHED` otherwise). **Publish** requires ≥ 1 target
  (`422 NO_TARGET`), stamps `publish_at`, and freezes the record. `expire` just sets
  `expires_at`.
- **Poll**: attaches 1:1 to a `poll` / `survey` announcement (`422 NOT_A_POLL`,
  `409 POLL_EXISTS`); ≥ 2 options. Status machine `draft → open → closed`; **opening requires
  the announcement to be published** (`422 ANNOUNCEMENT_DRAFT`).
- **Vote**: poll must be `open` (`422 POLL_NOT_OPEN`) and within `closes_at`
  (`422 POLL_CLOSED`); options must belong to the poll (`422 INVALID_OPTION`); exactly one
  option unless `allow_multiple` (`422 SINGLE_CHOICE_ONLY`); one response per user
  (`409 ALREADY_VOTED`). The vote response returns the live results.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/communication`. Full contract:
[`docs/backend/api/communication.md`](../../api/communication.md).

## Events

Audit (`audit_logs`, same transaction): `announcement.create` / `update` / `publish` /
`expire`, `poll.create`, `poll.open` / `poll.closed`, `poll.vote`. Push / email fan-out to
targeted residents lands with FR-15. `resident_groups` (schema §12) is deferred — targeting is
tower / unit / role / all for now.

## Seed

`seed_communication()` — one published "Welcome to GateSphere" all-community notice per community.

## Tests

`app/modules/communication/tests/test_communication_unit.py` (publish freeze, publish needs a
target, poll status machine + open-requires-published, voting rules — not-open / single-choice
/ already-voted / tally, closed poll rejects) and `test_communication_api.py` (health, auth
gate, resident sees the seeded notice, resident cannot create, full admin announcement→publish
→poll→open→resident-vote flow).

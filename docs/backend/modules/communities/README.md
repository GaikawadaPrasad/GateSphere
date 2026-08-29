# Module: Community & Property (FR-03)

> Canonical spec for the `communities` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-27). Reference module for the FR-* build-out.

## Purpose

The master-data spine every other module hangs off: `Community → Tower → Floor → Unit`, plus
`Gate`. `communities` is the multi-tenant isolation root and is **not** itself tenant-scoped;
every other table here carries `community_id` (`TenantMixin`) and uses a **composite tenant-safe
FK** to its parent so a child can never point at a parent in another community.

## Users & Permissions

| Action | Roles allowed |
|--------|---------------|
| View   | any role with `communities:view` — Super Admin, Community Admin, Association Committee, Facility Manager, Security roles, Auditor (scoped) |
| Create / Update towers, floors, units, gates | `communities:create` / `communities:update` **within the caller's active community** |
| Create a **community** | `communities:create` **and a global (Super Admin) scope** — else `403 GLOBAL_ONLY` |
| Delete a community | `communities:delete` + global scope (hard delete, cascades) |
| Export | Auditor, Community Admin, Super Admin (`communities:export` — reporting, not yet built) |

Frontend hides controls; the backend re-checks every call (AGENTS.md §3).

## Data model

Owned tables (`docs/database/schema.md §02`): `communities`, `gates`, `towers`, `floors`, `units`.

| Table | Key constraints |
|-------|-----------------|
| `communities` | `code` UQ (lower-cased) |
| `gates` | UQ `(community_id, code)` |
| `towers` | UQ `(community_id, name)`; UQ `(id, community_id)` (FK target) |
| `floors` | UQ `(community_id, tower_id, floor_number)`; composite FK `(tower_id, community_id) → towers` |
| `units` | UQ `(community_id, tower_id, floor_id, unit_number)`; composite FK `(floor_id, community_id, tower_id) → floors` |

RLS (`ENABLE ROW LEVEL SECURITY` + `tenant_isolation` policy) on `gates/towers/floors/units`
— migration `0004`.

Enums (`CHECK` in the app / values in `models.py`): `gate_type` (main·service·visitor·pedestrian·emergency),
`structure_type` (tower·block·villa_cluster·wing), `unit_type` (apartment·villa·penthouse·studio·shop·office).

## Business rules (service layer)

- A community is created only in a global scope; towers/floors/units/gates are created in the
  caller's **active community**, resolved from `TenantScope.require()` — never from the payload.
- `floor.tower` and `unit.floor` must resolve **within scope**; a cross-tenant reference → `404`
  (never `403`).
- `unit` inherits `community_id` + `tower_id` from its `floor`.
- Duplicate `code` / `name` / `number` → `409` with a stable `error.code`
  (`COMMUNITY_CODE_TAKEN`, `TOWER_NAME_TAKEN`, `GATE_CODE_TAKEN`, `FLOOR_NUMBER_TAKEN`, `UNIT_NUMBER_TAKEN`).
- Bad enum value → `422 INVALID_ENUM`.
- `is_active=False` is a soft disable (via `PATCH`), not a delete. Hard delete is community-only, global-scope-only.
- `total_floors` on a tower is bumped up as floors are added.

## State transitions

Property records have no lifecycle beyond `is_active` true/false.

## API

Base path `/api/v1/communities`. Full contract: [`docs/backend/api/communities.md`](../../api/communities.md); OpenAPI at `/docs`.

## Events

- Emails / notifications: none.
- Background jobs: none.
- **Audit events** (`audit_logs`, same transaction): `community.create/update/delete`,
  `gate.create`, `tower.create/update`, `floor.create`, `unit.create/update`.
- Cache invalidation: none (no cache yet).

## Dependencies

`users` (RBAC), `audit` (`record_audit_async`), `app.core.tenancy` (`TenantScope`,
`async_tenant_context`), `app.db.repository` (`AsyncTenantRepository`). Async stack (ADR-010).

## Failure scenarios

| Scenario | Result |
|----------|--------|
| No session | `401 NOT_AUTHENTICATED` |
| Missing permission | `403 PERMISSION_DENIED` |
| Non-Super-Admin creates a community | `403 GLOBAL_ONLY` |
| Community / tower / floor / unit outside the caller's scope | `404 NOT_FOUND` |
| Duplicate identifier | `409 <ENTITY>_*_TAKEN` |
| Unknown request field | `422 VALIDATION_ERROR` (`extra="forbid"`) |
| Bad enum | `422 INVALID_ENUM` |

## Ownership

Backend owner: _TBD_ · Web owner: _TBD_ · Docs owner: _TBD_

## Files

`backend/app/modules/communities/{models,schemas,repository,service,deps,router}.py` ·
migration `0004_communities_property_erd` · tests `tests/test_communities_{unit,api}.py`.

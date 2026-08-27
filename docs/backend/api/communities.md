# API — Community & Property (`/api/v1/communities`) — FR-03

All responses use the canonical envelope (`docs/platform/api-contract.md`). All endpoints require
a session; RBAC permission is noted per row. Community-scoped roles only ever see/act within their
own community — anything outside → `404`.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /communities` | `communities:view` | – | `200` list | `?active=true|false`, `?page`, `?page_size` (≤100), `?sort`, `?order` |
| `POST /communities` | `communities:create` + global scope | `CommunityCreate` | `201` single | `403 GLOBAL_ONLY` if community-scoped; `409 COMMUNITY_CODE_TAKEN` |
| `GET /communities/{id}` | `communities:view` | – | `200` single | `404` if outside scope |
| `PATCH /communities/{id}` | `communities:update` | `CommunityUpdate` | `200` single | partial; `is_active` toggles the soft flag |
| `DELETE /communities/{id}` | `communities:delete` + global scope | – | `204` | hard delete, cascades; `403 GLOBAL_ONLY` otherwise |
| `GET /communities/{id}/gates` | `communities:view` | – | `200` list | |
| `POST /communities/{id}/gates` | `communities:create` | `GateCreate` | `201` single | `409 GATE_CODE_TAKEN`; `422 INVALID_ENUM` |
| `GET /communities/{id}/towers` | `communities:view` | – | `200` list | |
| `POST /communities/{id}/towers` | `communities:create` | `TowerCreate` | `201` single | `409 TOWER_NAME_TAKEN` |
| `GET /communities/towers/{tower_id}` | `communities:view` | – | `200` single | |
| `PATCH /communities/towers/{tower_id}` | `communities:update` | `TowerUpdate` | `200` single | |
| `GET /communities/towers/{tower_id}/floors` | `communities:view` | – | `200` list | |
| `POST /communities/floors` | `communities:create` | `FloorCreate` (`tower_id`, `floor_number`, `label?`) | `201` single | `404` if tower outside scope; `409 FLOOR_NUMBER_TAKEN` |
| `GET /communities/floors/{floor_id}` | `communities:view` | – | `200` single | |
| `GET /communities/floors/{floor_id}/units` | `communities:view` | – | `200` list | |
| `POST /communities/units` | `communities:create` | `UnitCreate` (`floor_id`, `unit_number`, `unit_type?`, `bedrooms?`, `area_sqft?`) | `201` single | inherits `community_id`+`tower_id` from the floor; `409 UNIT_NUMBER_TAKEN` |
| `GET /communities/units/{unit_id}` | `communities:view` | – | `200` single | |
| `PATCH /communities/units/{unit_id}` | `communities:update` | `UnitUpdate` | `200` single | |

## Schemas

- **CommunityCreate**: `code` (1–32, `^[A-Za-z0-9][A-Za-z0-9 _\-/]*$`, stored lower-case),
  `name`, `address_line1/2?`, `city?`, `state?`, `postal_code?`, `country="India"`, `timezone="Asia/Kolkata"`.
- **GateCreate**: `code`, `name`, `gate_type="main"`, `latitude?` (−90..90), `longitude?` (−180..180).
- **TowerCreate**: `code`, `name`, `structure_type="tower"`, `total_floors=0` (0..300).
- **FloorCreate**: `tower_id`, `floor_number` (−10..300), `label?`.
- **UnitCreate**: `floor_id`, `unit_number`, `unit_type="apartment"`, `bedrooms?` (0..20), `area_sqft?` (>0).
- All write bodies are `extra="forbid"` — an unknown field → `422`.
- `*Read` adds `id`, `created_at`, `updated_at` (+ `community_id`, `tower_id`, `floor_id` where applicable), `is_active`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `GLOBAL_ONLY` · `NOT_FOUND` · `VALIDATION_ERROR` ·
`INVALID_ENUM` · `COMMUNITY_CODE_TAKEN` · `GATE_CODE_TAKEN` · `TOWER_NAME_TAKEN` ·
`FLOOR_NUMBER_TAKEN` · `UNIT_NUMBER_TAKEN` · `CSRF_INVALID` (unsafe method without `X-CSRF-Token`).

## Audit

`community.{create,update,delete}`, `gate.create`, `tower.{create,update}`, `floor.create`,
`unit.{create,update}` — written to `audit_logs` in the same transaction.

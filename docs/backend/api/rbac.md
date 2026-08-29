# API — Configurable RBAC (`/api/v1/rbac`) — FR-02 extension

Canonical envelope. **Reads** need `users:view`. **Writes** are **platform admin only**
(`super_admin` / `is_superadmin`) — a community admin cannot edit permission sets.

Model:

- **Global role permissions** live in `role_permissions`. Editing them changes the default
  for that role everywhere. `super_admin` is a wildcard role and is not editable.
- **Per-community overrides** live in `community_role_permissions` (`effect` = `allow` | `deny`).
  Effective permissions for a role *in a community* = `global defaults + allows - denies`,
  resolved per request in `app.core.security.user_permissions_async`.
- Every change bumps `users.permission_version` for the affected users and revokes their
  live sessions, so they re-authenticate with the new set. The frontend polls `/auth/me`
  and refreshes its cache when `permission_version` moves.
- `ROLE_PERMISSIONS` in `app/core/rbac.py` is the seed default — `reset` restores it.

## Endpoints

| Method & path | Access | Body | Notes |
|---|---|---|---|
| `GET /rbac/health` | – | – | liveness |
| `GET /rbac/permissions` | `users:view` | – | full permission catalogue (`code`, `description`) |
| `GET /rbac/roles` | `users:view` | – | every role with `permissions` (current) + `default_permissions` (seed) + `is_wildcard` |
| `PUT /rbac/roles/{slug}/permissions` | platform admin | `{permissions: [code,…]}` | replace the role's global set; `422 ROLE_NOT_EDITABLE`, `422 UNKNOWN_PERMISSION` |
| `POST /rbac/roles/{slug}/permissions` | platform admin | `{code}` | add one |
| `DELETE /rbac/roles/{slug}/permissions/{code}` | platform admin | – | remove one |
| `POST /rbac/roles/{slug}/permissions/reset` | platform admin | – | restore seed defaults |
| `GET /rbac/communities/{community_id}/overrides` | `users:view` | – | all override rows for the community |
| `GET /rbac/communities/{community_id}/roles/{slug}/effective` | `users:view` | – | `{default_permissions, allow, deny, effective_permissions}` |
| `PUT /rbac/communities/{community_id}/roles/{slug}/permissions` | platform admin | `{allow: [code,…], deny: [code,…], note?}` | upsert the community's overrides for the role; `422 CONFLICTING_OVERRIDE` if a code is in both |
| `DELETE /rbac/communities/{community_id}/roles/{slug}/permissions/{code}` | platform admin | – | drop one override |

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `PLATFORM_ADMIN_ONLY` · `NOT_FOUND` ·
`ROLE_NOT_EDITABLE` · `UNKNOWN_PERMISSION` · `CONFLICTING_OVERRIDE`

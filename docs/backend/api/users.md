# API — Users & Role Management (`/api/v1/users`) — FR-02

Canonical envelope. All endpoints require a session. A global caller (Super Admin) manages
every user; a community-scoped caller (Community Admin) manages users **within their
community** — a user with no role grants, or one whose grants intersect the caller's
communities. A user outside that set → `404`.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /users/health` | – (session) | – | `200` | liveness |
| `GET /users/roles` | `users:view` | – | `200` list | every role + its effective permission codes (`["*"]` for super_admin) |
| `GET /users` | `users:view` | – | `200` list | `?q=`, `?role_slug=`, `?community_id=`, `?active=` |
| `POST /users` | `users:create` | `UserCreate` | `201` single | `409 EMAIL_TAKEN`; optional inline `role_slug` (+ `community_id`) |
| `GET /users/{user_id}` | `users:view` | – | `200` single | `404` outside scope |
| `PATCH /users/{user_id}` | `users:update` | `UserUpdate` | `200` single | deactivating (`is_active=false`) revokes the user's sessions |
| `POST /users/{user_id}/roles` | `users:update` | `RoleGrantIn` | `201` single | `403 GLOBAL_ONLY` (scoped caller, null community); `422 GLOBAL_ROLE_ONLY` (super_admin/auditor with a community); `409 GRANT_EXISTS`. Revokes the user's sessions. |
| `DELETE /users/{user_id}/roles/{grant_id}` | `users:update` | – | `204` | revokes the user's sessions |

## Schemas (write — all `extra="forbid"`)

- **UserCreate**: `email`, `full_name`, `password` (≥ 10), `phone?`, `role_slug?`, `community_id?`.
- **UserUpdate**: `full_name?`, `phone?`, `is_active?`.
- **RoleGrantIn**: `role_slug`, `community_id?` (null = platform-global grant — global caller only).

`UserRead` embeds `roles: [RoleGrantRead]` (`role_slug`, `role_name`, `community_id`).

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `EMAIL_TAKEN` ·
`GLOBAL_ONLY` · `GLOBAL_ROLE_ONLY` · `GRANT_EXISTS` · `CSRF_INVALID`.

## Audit

`user.create`, `user.update`, `role.grant`, `role.revoke` — written to `audit_logs` in the
same transaction. **Every grant / revoke / deactivate calls `revoke_all_user_sessions`** so a
permission change takes effect on the target's next request.

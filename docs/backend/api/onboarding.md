# API — Tenant Onboarding — FR-03

URL invitations + direct add / remove of tenants. Canonical envelope.

The invitation `token` endpoints are **public** (an invitee may not have an account yet).
Everything else needs a session; community-scoped callers only act within their own
community (else `404`).

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /onboarding/health` | – | – | `200` | liveness |
| `POST /communities/{community_id}/invitations` | `residents:create` | `InvitationCreate` | `201` `InvitationCreated` | returns `token` + `accept_url` **once**; `409 INVITATION_EXISTS`, `409 PRIMARY_OCCUPANT_EXISTS`, `404` if unit/community outside scope |
| `GET /communities/{community_id}/invitations` | `residents:view` | – | `200` list | `?invite_status=pending|accepted|revoked|expired`, `?page`, `?page_size` |
| `POST /communities/{community_id}/invitations/{invitation_id}/revoke` | `residents:create` | – | `200` `InvitationRead` | `422 INVITATION_NOT_PENDING` |
| `GET /invitations/{token}` | public | – | `200` `InvitationPublic` | community name, unit label (`Tower / Floor / Unit`), inviter, `account_exists` (login vs set-password); auto-expires a stale pending invite |
| `POST /invitations/{token}/accept` | public | `InvitationAccept` | `200` `TenantOut` | creates `ResidentProfile` (active) + `UnitOccupancy` + optional `EmergencyContact`s + community `resident` grant; sets session cookies when it creates/authenticates the account; `422 PASSWORD_REQUIRED`, `403 LOGIN_REQUIRED`, `422 INVITATION_NOT_PENDING` |
| `POST /communities/{community_id}/tenants` | `residents:create` | `TenantAdd` | `201` `TenantOut` | direct add; creates the user if the email is new; `409 OCCUPANCY_EXISTS` / `PRIMARY_OCCUPANT_EXISTS` |
| `DELETE /communities/{community_id}/tenants/{profile_id}` | `residents:delete` | – | `200` `TenantOut` | ends every active occupancy, profile → `moved_out`, revokes the community `resident` grant (bumps `permission_version` + kills sessions) |
| `DELETE /communities/{community_id}/units/{unit_id}/occupants/{occupancy_id}` | `residents:delete` | – | `200` `OccupancyOut` | ends one occupancy; if it was the resident's last active one in the community, also `moved_out` + grant revoke |

## Schemas (write — all `extra="forbid"`)

- **InvitationCreate**: `unit_id`, `invited_email`, `invited_phone?`, `full_name?`, `role_slug="resident"`, `occupancy_role="tenant"`, `is_primary=false`, `agreement_reference?`, `message?`, `expires_in_days=14` (1–90).
- **InvitationAccept**: `password?` (≥10; required only when the email has no account), `full_name?`, `phone?`, `date_of_birth?`, `id_type?`, `id_number?`, `move_in_date?`, `emergency_contacts?` (≤5 — `name`, `relationship` alias, `phone`, `alternate_phone?`, `priority`).
- **TenantAdd**: `email`, `full_name`, `phone?`, `password?`, `unit_id`, `occupancy_role="tenant"`, `is_primary=false`, `agreement_reference?`, `move_in_date?`, `role_slug="resident"`.

## Read shapes

- **InvitationCreated** = `InvitationRead` + `token`, `accept_url`.
- **TenantOut**: `resident_profile_id`, `user_id`, `email`, `full_name`, `community_id`, `profile_status`, `occupancies[]`, `account_created`, `logged_in`.

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` ·
`INVITATION_EXISTS` · `INVITATION_NOT_PENDING` · `PASSWORD_REQUIRED` · `LOGIN_REQUIRED` ·
`PRIMARY_OCCUPANT_EXISTS` · `OCCUPANCY_EXISTS` · `INVALID_OCCUPANCY_ROLE`

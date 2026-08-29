# Security — Roles & Permissions (RBAC)

Canonical catalogue lives in code: `backend/app/core/rbac.py` (`ROLES`, `PERMISSIONS`,
`ROLE_PERMISSIONS`). This doc is the human-readable matrix — keep it in sync.

## Roles (10, per PRD §3)

| Slug | Role | Scope |
|------|------|-------|
| `super_admin` | Super Admin | Global platform (all communities) |
| `community_admin` | Community Admin | One community |
| `association_committee` | Association Committee | Governance / oversight (one community) |
| `facility_manager` | Facility Manager | Operations & maintenance (one community) |
| `security_supervisor` | Security Supervisor | Gate security oversight (one community) |
| `security_guard` | Security Guard | Live gate operations (one community) |
| `resident` | Owner / Tenant | Own unit(s) |
| `domestic_staff` | Domestic Staff | Assigned units, self |
| `vendor_technician` | Vendor / Technician | Assigned tickets |
| `auditor` | Auditor | Read-only compliance (global) |

## Permission strings

Format `"<module>:<action>"`. Actions: `view`, `create`, `update`, `delete`, `approve`, `export`.
Modules: users, communities, residents, visitors, gate, domestic_staff, deliveries, vehicles,
billing, complaints, amenities, communication, incidents, notifications, audit, dashboards.

`super_admin` implicitly holds `*`.

## Starter grants

See `ROLE_PERMISSIONS` in `rbac.py`. Summary:

| Role | Highlights |
|------|-----------|
| community_admin | everything in its community except `audit:*` |
| association_committee | `billing:view/export`, `incidents:view`, `dashboards:view`, `audit:view` |
| facility_manager | amenities CRUD, complaints view/update, dashboards |
| security_supervisor | visitors view/approve, gate view/update/**approve** (checkpoint override), incidents view/create |
| security_guard | visitors view/create, gate view/create/update, deliveries view/create |
| resident | visitors view/create/approve, billing view, complaints view/create, amenities view/create, vehicles view/create |
| domestic_staff | gate view |
| vendor_technician | complaints view/update, gate view |
| auditor | `*:view` + `billing:export`, `audit:view/export` |

## Enforcement

- **API**: `require_permission("<module>:<action>")` on every non-public route (`backend/app/core/security.py`).
- **Tenant scope**: derived from the user's `user_roles.community_id` grant — never trusted from the client.
- **Frontend**: hides/disables controls the user lacks — cosmetic only; the server is authoritative.
- **Tests**: each module tests 401 (no session) and 403 (wrong role) paths.

## Changing the matrix

1. Edit `rbac.py`.
2. `make seed` (idempotent — adds new perms/grants).
3. Update this table.
4. Add/adjust tests.

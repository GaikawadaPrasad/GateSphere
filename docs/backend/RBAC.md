# GateSphere — RBAC

Canonical: `docs/security/roles-permissions.md` (matrix) + this file (implementation).
Code: `app/core/rbac.py` (catalogue), `app/core/tenancy.py::require_permission_async`,
`app/modules/rbac/` (config API), `app/modules/residents/access.py` (row-level).

## The 10 roles (fixed DB enum — no more, no less)

`super_admin` · `community_admin` · `association_committee` · `facility_manager` ·
`security_supervisor` · `security_guard` · `resident` · `domestic_staff` ·
`vendor_technician` · `auditor`

## Permission codes

`<module>:<verb>` where verb ∈ `view · create · update · approve · delete · export`.
**54 distinct codes are actually enforced on routes** (of the full ~96-code catalogue).
`super_admin` additionally short-circuits to `{"*"}` via `user.is_superadmin`.

## Enforcement — three layers

| Layer | Where | What |
|---|---|---|
| **Route gate** | `Depends(require_permission_async("<code>"))` on every non-public route | coarse: caller's **effective** permission set for the active community |
| **Object / row** | `UnitScopedAccess` mixin in services (`residents/access.py`) | a plain `resident` may act only on records for units they occupy; `user_in_community()` validates payload user-ids |
| **Tenant** | repository `_scoped()` + Postgres RLS on 56 tables | cross-community object → **404** (never 403) |

Platform-only operations use `require_platform_admin` (`is_superadmin`) — the 6 `rbac`
role-permission mutation routes.

## Effective permissions (per community)

`get_tenant_scope_async` resolves `scope.permissions` to:
`role defaults ± that community's community_role_permissions overrides (allow/deny)` —
**only** when the caller's active community is unambiguous (a single community grant, or an
`X-Community-Id` header). For a global or multi-community caller it is the coarse union
across every role they hold. Configurable per community via
`PUT /api/v1/rbac/communities/{cid}/roles/{slug}/permissions` (platform-admin).

Any RBAC change (`role_permissions`, `community_role_permissions`, a role grant/revoke)
bumps `users.permission_version` and **revokes the affected users' live sessions**
(`invalidate_user_permissions_async`) so they re-authenticate with the new set.

## Seeded role → permission-count (this build)

| Role | # codes | Character |
|---|---|---|
| `super_admin` | 96 (+ `*` short-circuit) | everything |
| `community_admin` | 90 | full community management (no `audit:*`) |
| `security_supervisor` | 22 | gate/visitors/deliveries/vehicles/incidents + `gate:approve`, `visitors:approve`, `incidents:update` |
| `resident` | 21 | self-service: create visitors/deliveries/complaints/vehicles/staff, `visitors:approve` + `deliveries:approve` for **their own** unit (row-scoped) |
| `security_guard` | 19 | like supervisor minus the `approve`/`incidents:update` |
| `auditor` | 18 | **`:view` + `:export` only** — every write route rejects the auditor role |
| `association_committee` | 11 | billing + communication approve/create, `audit:view`, dashboards |
| `facility_manager` | 7 | amenities create/update, complaints update, dashboards |
| `vendor_technician` | 4 | `complaints:update/view`, `gate:view`, `notifications:view` |
| `domestic_staff` | 2 | `gate:view`, `notifications:view` |

## Auditor is read-only — verified

Auditor holds no `:create/:update/:approve/:delete` code; `audit` routes are GET-only
(`audit:view` / `audit:export`); `tests/test_cross_tenant_idor.py` +
`app/modules/rbac/tests/` + the Postman `_Negative` folder ("Auditor cannot write → 403")
all assert it.

## Cross-tenant

Community A's admin cannot read/mutate Community B's objects — enforced at the repository
(`_scoped()`), backstopped by RLS, and proven by `tests/test_cross_tenant_idor.py`
(14 entity types × 2 roles) + `tests/test_tenant_isolation.py` (DB RLS with a
`NOBYPASSRLS` role).

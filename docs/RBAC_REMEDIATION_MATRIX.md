# GateSphere Enterprise (GSE-2026) — Role-Based Access Control (RBAC) Master Matrix

**Document Version:** 1.0.0  
**Enforcement Model:** Server-side dependency `require_permission_async("<module>:<action>")` + DB Scope Filters (`community_id`) + Unit Scoping (`actor_unit_scope`).  

---

## 1. The 10 Canonical System Roles

GateSphere Enterprise enforces exactly 10 roles across all tenant operations. Free-text role strings are strictly forbidden.

| Role Slug | Title | Access Scope | Role Description |
|---|---|---|---|
| `super_admin` | Super Administrator | Global (`*`) | Full platform access, community creation, global system settings. |
| `community_admin` | Community Administrator | Tenant Scoped | Full administrative control over assigned community. |
| `association_committee` | Association Committee | Tenant Scoped | Financial summaries, ledgers, assessments, announcements, communications. |
| `facility_manager` | Facility Manager | Tenant Scoped | Complaints, SLA management, vendors, amenities, maintenance, incident management. |
| `security_supervisor` | Security Supervisor | Tenant Scoped | Gate operations, guard rosters, emergency alerts, blacklist management, security analytics. |
| `security_guard` | Security Guard | Tenant Scoped | Live gate verification console, visitor entry/exit logs, delivery arrival, panic alert creation. |
| `resident` | Resident (Owner/Tenant) | Own Unit Scoped | Visitor pre-approval, unit invoice payments, unit complaint creation, amenity booking, profile management. |
| `domestic_staff` | Domestic Staff | Assigned Units | Staff attendance check-in/out, digital pass verification, assigned resident tasks. |
| `vendor_technician` | Vendor Technician | Assigned Tickets | Assigned work order execution, completion proof upload, entry pass verification. |
| `auditor` | Independent Auditor | Read-Only (`GET`) | Full inspection read access across financial ledgers, audit logs, user access reports. **Zero write access.** |

---

## 2. Module × Role Authorization Matrix

Legend: `V` = View, `C` = Create, `U` = Update, `D` = Delete, `A` = Approve / Transition, `X` = Export / Special, `-` = Denied (403/404).

| Module | Super Admin | Community Admin | Committee | Facility Mgr | Security Sup | Security Guard | Resident | Staff | Vendor | Auditor |
|---|---|---|---|---|---|---|---|---|---|---|
| `auth` | `*` | V,U | V,U | V,U | V,U | V,U | V,U | V,U | V,U | V |
| `users` | `*` | V,C,U,D | V | V | V | - | - | - | - | V |
| `communities` | `*` | V,U | V | V | V | V | V | V | V | V |
| `visitors` | `*` | V,C,U,D | V | V | V,C,U,D | V,C,U | V,C,U (Own Unit) | - | - | V |
| `gate` | `*` | V,C,U,D | V | V | V,C,U,D,A | V,C,U,A | V,C (Alert) | - | - | V |
| `domestic_staff`| `*` | V,C,U,D | V | V | V | V (Verify) | V,C (Rate) | V,C (Clock) | - | V |
| `deliveries` | `*` | V,C,U,D | V | V | V,C,U | V,C,U | V,C (Own Unit) | - | - | V |
| `vehicles` | `*` | V,C,U,D | V | V | V,C,U | V,C (Check) | V,C (Own Unit) | - | - | V |
| `billing` | `*` | V,C,U,D,A | V,C,A,X | V,C,U,X | - | - | V,C (Own Invoice) | - | - | V,X |
| `complaints` | `*` | V,C,U,D,A | V | V,C,U,A,X | V | V | V,C,U (Confirm) | - | V,U (Work) | V |
| `amenities` | `*` | V,C,U,D | V | V,C,U,D | V | V | V,C (Book) | - | - | V |
| `communication` | `*` | V,C,U,A | V,C,U,A | V,C,U,A | V,C | V | V,C (Vote/RSVP) | - | - | V |
| `incidents` | `*` | V,C,U,D,A | V | V,C,U,A | V,C,U,A | V,C | V,C (Report) | - | - | V |
| `dashboards` | `*` | Full Admin | Committee | Facility | Security | Guard | Resident | Staff | Vendor | Auditor |
| `notifications` | `*` | V,C,U | V,C | V,C | V,C | V | V (Inbox) | V (Inbox) | V (Inbox) | V |
| `audit` | `*` | V,X | V,X | V,X | V,X | - | - | - | - | V,X |

---

## 3. Mandatory Security Invariants

### 1. Auditor Role Invariant
- **Rule:** The `auditor` role holds only `*:view` and `*:export` permissions.
- **Enforcement:** Every POST, PUT, PATCH, and DELETE route enforces `require_permission_async("<module>:<action>")` with `create`, `update`, `delete`, `approve`, `rate`, `vote`, or `confirm`.
- **Verification:** Auditor attempting state mutation returns `403 Forbidden` (`test_auditor_read_only_mutations_denied`).

### 2. Tenant Isolation Invariant
- **Rule:** Users cannot access or view records belonging to other communities.
- **Enforcement:** Parameterized `community_id` predicate applied to all repository queries and validated against active user session grants. Cross-tenant targets yield `404 Not Found` (never 403) to prevent enumeration.

### 3. Own-Unit Resident Scoping Invariant
- **Rule:** Plain residents without administrative roles access only records for units they actively occupy.
- **Enforcement:** `actor_unit_scope(db, actor)` returns `frozenset[unit_id]`. If the user has no direct active occupancy in `UnitOccupancy`, `frozenset()` is returned.

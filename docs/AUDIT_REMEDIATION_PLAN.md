# GateSphere Enterprise (GSE-2026) — Audit Remediation Master Plan

**Document Version:** 1.0.0  
**Baseline Score:** 80.9 / 100  
**Target Score:** 100 / 100 (Eliminate 100% of Critical & High defects, complete mandatory PRD workflows)

---

## 1. Executive Summary & Architecture Map

### Architecture Flow
```
Next.js Page Component / UI Guard
        │
        ▼ (TanStack Query / API Client)
/api/v1 Router
        │
        ├─► Session / Auth Dependency (Server-side Session & CSRF verification)
        ├─► RBAC Permission Gate (require_permission_async("<module>:<action>"))
        ├─► Tenant Scope Filter (community_id binding)
        └─► Row-Level / Unit Scope (actor_unit_scope)
        │
        ▼
Service Layer (Business Logic & State Machine Rules)
        │
        ▼
Repository Layer (SQLAlchemy 2.0 Queries)
        │
        ▼
PostgreSQL Database (Multi-Tenant Scoped Tables)
```

---

## 2. Audit Remediation Matrix by Phase

### Phase A — Critical Security & Authorization (P0)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **SEC-01** | **CRITICAL** | **Auditor Can Mutate State**: Auditor holds `*:view` permissions, but endpoints for complaint confirmation, messages, feedback, staff rating, poll voting & event RSVP are gated by `view` permissions instead of distinct mutation permissions. | `backend/app/core/rbac.py`<br>`backend/app/modules/complaints/router.py`<br>`backend/app/modules/domestic_staff/router.py`<br>`backend/app/modules/communication/router.py` | 1. Create distinct fine-grained permissions or gate mutation endpoints with `create`/`update`/`confirm`/`rate`/`vote` permissions.<br>2. Ensure Auditor role only has `*:view` + `*:export` and cannot execute mutation endpoints.<br>3. Verify legitimate roles (`resident`, `facility_manager`, `security_supervisor`, `vendor_technician`) retain required mutation access. | Backend RBAC tests in `test_remediation_critical.py`: Auditor GET allowed (200), Auditor mutation returns 403. | PENDING APPROVAL |
| **SEC-02** | **CRITICAL** | **Dashboard Financial / Security Authorization**: Financial dashboard stats are accessible to plain residents via `billing:view` or `dashboards:view`. Security guard should not access financial dashboard totals. | `backend/app/modules/dashboards/router.py`<br>`backend/app/modules/dashboards/service.py` | 1. Gate `GET /dashboards/financial` with `billing:view`. In `DashboardService.financial`, check if `actor` is unit-restricted (plain resident) and raise `ForbiddenError` (403).<br>2. Ensure `security_guard` gets 403 on `/dashboards/financial`.<br>3. Ensure `GET /dashboards/security` uses `gate:view`. | Dashboard auth tests: Resident -> 403 on financial dashboard, Security Guard -> 403 on financial dashboard, Community Admin / FM -> 200. | PENDING APPROVAL |
| **SEC-03** | **HIGH** | **Ungated API Routes**: 21 endpoints lack explicit permission/auth dependencies. | `backend/app/api/router.py`<br>Module routers (`residents`, `domestic_staff`, `uploads`, `gate`, `auth`) | Classify each route (Public, Authenticated-only, Permission-protected, Self-service with ownership check, Platform-admin). Apply `require_permission_async` or explicit owner validation. | API security tests verifying 401 for unauthenticated and 403 for unauthorized access across all 21 routes. | PENDING APPROVAL |
| **SEC-04** | **CRITICAL** | **Resident Unit Scope Leak**: `actor_unit_scope` falls back to querying all occupied units in the community if the user has a community role but no direct active occupancy in `UnitOccupancy`. | `backend/app/modules/residents/access.py` | Remove community fallback in `actor_unit_scope`. If user has no active unit occupancy, return `frozenset()` (empty scope) rather than all units. | Unit scope adversarial tests: Resident with Unit A cannot access Unit B; Resident without occupancy receives empty scope; cross-unit role behaves correctly. | PENDING APPROVAL |
| **SEC-05** | **HIGH** | **Vendor Cross-Unit Scope Over-exposure**: `vendor_technician` is listed in `CROSS_UNIT_ROLES` in `access.py`, bypassing unit-level access checks without assignment. | `backend/app/modules/residents/access.py`<br>`backend/app/modules/complaints/service.py` | Remove `vendor_technician` from `CROSS_UNIT_ROLES`. Enforce ticket/unit assignment verification on vendor access paths. | Vendor assignment tests: Vendor assigned to Ticket A can access Ticket A; vendor unassigned gets 404/403. | PENDING APPROVAL |
| **SEC-06** | **HIGH** | **CSRF Bucket Isolation Defect**: `verify_csrf()` accepts any valid CSRF cookie in the request cookie jar rather than enforcing matching bucket pair. | `backend/app/core/security.py`<br>`backend/app/modules/auth/deps.py` | Enforce that `gatesphere_<bucket>_csrf` matches the active `gatesphere_<bucket>_session` bucket context. | CSRF bucket isolation tests: request with Security bucket session + Resident bucket CSRF cookie fails with 403. | PENDING APPROVAL |
| **SEC-07** | **HIGH** | **Complaint Confirmation / Feedback Ownership**: Ticket confirmation & feedback endpoints do not enforce that `ticket.raised_by_user_id == actor.id` or complainant occupancy. | `backend/app/modules/complaints/router.py`<br>`backend/app/modules/complaints/service.py` | Enforce ownership check: ticket confirmation & feedback must be performed by the resident who raised the ticket or occupied the unit. Prevent staff impersonation. | Complaint ownership tests: Resident A confirming Resident B's ticket returns 403/404; FM/Vendor trying to confirm returns 403. | PENDING APPROVAL |
| **SEC-08** | **HIGH** | **Family Member Route Authorization**: Family member management routes lack proper role and ownership scope. | `backend/app/modules/residents/router.py`<br>`backend/app/modules/residents/service.py` | Secure `/residents/family-members/*`: Residents limited to own unit/family; admins restricted by community scope; vendors/auditors prevented from mutating. | Family member authorization tests for all 10 roles. | PENDING APPROVAL |

---

### Phase B — Data Integrity & Amenity Operations (P1)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **DAT-01** | **CRITICAL** | **GET Amenity Slots Mutates DB State**: `GET /amenities/{id}/slots` deletes/generates synthetic slot records in database during GET request. | `backend/app/modules/amenities/router.py`<br>`backend/app/modules/amenities/service.py` | Make GET `/amenities/{id}/slots` strictly side-effect free. Move slot initialization to `create_amenity` or an explicit `POST /amenities/{id}/slots/bootstrap`. | Regression tests: Create custom slots -> GET slots -> verify DB rows unchanged -> repeated GETs produce no duplicate/deleted slots. | PENDING APPROVAL |
| **DAT-02** | **HIGH** | **Amenity Maintenance Block Unblock Defect**: Frontend `unblockSlot` calls amenity reactivate endpoint instead of unblocking the maintenance block; backend missing block delete endpoint. | `backend/app/modules/amenities/router.py`<br>`backend/app/modules/amenities/service.py`<br>`frontend/lib/api.ts` | Add `DELETE /api/v1/amenities/blocks/{block_id}` on backend. Update frontend `unblockSlot` in `lib/api.ts` to invoke block deletion endpoint. | Maintenance block deletion backend & frontend integration tests. | PENDING APPROVAL |
| **DAT-03** | **HIGH** | **Amenity Timezone Misinterpretation**: Amenity slot times risk treating local times as UTC or server timezone. | `backend/app/modules/amenities/service.py` | Interpret user/community slot inputs in community IANA timezone, convert to UTC for DB comparison & storage. | Timezone boundary tests (DST change, local midnight vs UTC midnight, slot overlap check). | PENDING APPROVAL |

---

### Phase C — Authentication & Session Management (P1)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **AUTH-01**| **HIGH** | **Missing Password Change Endpoint**: `POST /api/v1/auth/password` missing or incomplete. | `backend/app/modules/auth/router.py`<br>`backend/app/modules/auth/service.py` | Implement `POST /api/v1/auth/password` with current password verification, Argon2 hashing, new password strength rules, same-password check, session revocation (`revoke_all_user_sessions_async`), and audit logging. | Password change suite: current password match, weak password fail, same password fail, session revocation verification, re-login success. | PENDING APPROVAL |

---

### Phase D — Mandatory Frontend Integrations & Upload Pipeline (P1)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **UI-01**  | **HIGH** | **Missing Reusable Upload Component & Unconfirmed URLs**: Frontends pass raw strings/URLs without integrating backend presigned upload confirmation. | `frontend/components/ui/file-upload.tsx`<br>Visitor/Staff/Complaint/Vendor/Incident UI components | Build `<FileUpload kind="...">` supporting presigned URL request, direct S3 upload, upload confirmation API call, loading state, MIME/size validation. Wire into Visitor entry, Staff photo/ID, Ticket attachments, Incident evidence, Parking violation evidence. | Component unit tests & integration tests verifying presigned upload flow and unconfirmed URL prevention. | PENDING APPROVAL |
| **UI-02**  | **HIGH** | **Visitor Policy Photo & OTP Enforcement**: `record_entry` does not enforce `VisitorPolicy.photo_required` or `otp_required`. | `backend/app/modules/visitors/service.py`<br>`backend/app/modules/gate/service.py` | Enforce `VisitorPolicy.photo_required` in `record_entry` (reject entry if photo missing when required). Handle OTP requirement per policy. | Gate entry tests: `photo_required=True` with no photo -> rejected (400/422); with photo -> allowed. | PENDING APPROVAL |

---

### Phase E — Missing Business Modules & Workflows (P1)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **MOD-01** | **HIGH** | **Vehicle & Parking Module UI Missing**: Backend APIs exist, but frontend management views for vehicles, parking slots, allocations, and violations are incomplete. | `frontend/app/(protected)/vehicles/`<br>`frontend/app/(protected)/parking/`<br>`frontend/lib/api.ts` | Build complete Next.js UI: Resident vehicle CRUD, FM parking slot creation/allocation/occupancy, Guard vehicle gate check, Violation reporting & evidence attachment. | Frontend & backend integration tests for vehicle lifecycle and parking allocation. | PENDING APPROVAL |
| **MOD-02** | **HIGH** | **Billing Recurring Invoices & Financial Workflows**: Celery task for monthly invoice generation missing; late fee & advance payment credit handling incomplete. | `backend/app/modules/billing/tasks.py`<br>`backend/app/modules/billing/service.py` | 1. Implement Celery idempotent task `generate_monthly_invoices`.<br>2. Implement late fee calculation (fixed/percentage mode).<br>3. Implement penalty charge-head workflow.<br>4. Implement advance payment on-account credit balance accounting. | Financial invariant tests: invoice generation idempotency, late fee math, advance payment ledger balancing. | PENDING APPROVAL |
| **MOD-03** | **HIGH** | **Delivery Direct Rejection Protocol**: 4th PRD delivery protocol (`direct_rejection`) missing in protocol routing. | `backend/app/modules/deliveries/service.py`<br>`frontend/app/(protected)/deliveries/` | Add `direct_rejection` to `PROTOCOL_TYPES`, create decision branch in `create_delivery` and gate verification lifecycle. Update frontend UI. | Delivery protocol tests covering all 5 protocols (`leave_at_gate`, `collect_at_gate`, `direct_to_door`, `call_resident`, `direct_rejection`). | PENDING APPROVAL |
| **MOD-04** | **HIGH** | **Vendor Entry Pass Integration**: `GET /complaints/tickets/{id}/entry-pass` missing endpoint or disconnected from gate verification. | `backend/app/modules/complaints/router.py`<br>`backend/app/modules/gate/service.py` | Implement `GET /complaints/tickets/{id}/entry-pass` and link vendor ticket entry pass to gate scanner validation & work completion proof workflow. | Vendor entry pass end-to-end lifecycle test (ticket assignment -> entry pass -> gate checkin -> work proof -> checkout). | PENDING APPROVAL |

---

### Phase F — Administration & Operations (P2)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **ADM-01** | **MEDIUM**| **RBAC Administration UI Missing**: Platform/Community admins lack frontend UI to manage role permissions and community overrides. | `frontend/app/(protected)/admin/rbac/`<br>`frontend/lib/api.ts` | Build RBAC management UI using existing `/api/v1/rbac` endpoints: role permissions matrix, community overrides, effective permission preview, dangerous change confirmation. | Admin UI integration tests & RBAC permission update validation. | PENDING APPROVAL |
| **ADM-02** | **MEDIUM**| **Resident Invitation UI & Accept Flow**: Admin invite screen and `/invitations/[token]` page incomplete. | `frontend/app/(protected)/admin/invitations/`<br>`frontend/app/(public)/invitations/[token]/` | Build invitation creation screen and public `/invitations/[token]` acceptance page. Validate token, expiry, community/unit binding, account creation, password setup, audit logging. | Token validation tests: expired token -> 400; reused token -> 400; cross-community acceptance -> 403; successful invite -> 200. | PENDING APPROVAL |

---

### Phase G — Reporting, Cleanup & UX Polish (P2)

| Finding ID | Severity | Description & Root Cause | Files Involved | Proposed Fix | Tests Required | Status |
|---|---|---|---|---|---|---|
| **REP-01** | **MEDIUM**| **Security Supervisor Reports Wiring Defect**: `reportType` and `timeframe` do not alter query on `security-supervisor/reports/page.tsx`. | `frontend/app/security-supervisor/reports/page.tsx` | Wire `reportType` and `timeframe` state to respective API filter params (gate traffic, incidents, visitors, deliveries, staff activity). Add CSV export trigger. | Report query filter tests & export verification. | PENDING APPROVAL |
| **CLN-01** | **LOW**   | **Dead API Client Methods**: Obsolete/broken methods in `frontend/lib/api.ts` (`verifyPass`, `occupancies`, `family`, `incidents.resolve`, `polls`). | `frontend/lib/api.ts` | Audit every method in `lib/api.ts` against actual FastAPI router endpoints. Remove dead methods; update mismatched routes to match backend. | Typecheck (`tsc --noEmit`) & frontend Vitest suite. | PENDING APPROVAL |
| **CLN-02** | **MEDIUM**| **Domestic Staff Verification Widget Inconsistency**: Card displays "Verified" above "No verification ID on file". | `frontend/components/domestic-staff/verification-card.tsx` | Standardize status model: `Not Submitted`, `Pending Verification`, `Verified`, `Rejected`. Show verification ID input/display based on actual status. | Component render tests for each verification status state. | PENDING APPROVAL |
| **CLN-03** | **LOW**   | **Notification Route Alias Cleanup**: Multiple duplicate mark-all-read routes exist. | `backend/app/modules/notifications/router.py` | Collapse duplicate mark-all-read routes into canonical `/notifications/read-all` endpoint. Update callers and OpenAPI specs. | Router tests & OpenAPI validation. | PENDING APPROVAL |
| **CLN-04** | **LOW**   | **Alert to Toast Migration**: 68 raw browser `alert()` calls disrupt UX. | Frontend components across modules | Replace browser `alert()` with `useToast()` notifications. Preserve native `confirm()` only for destructive actions. | Frontend Vitest render & action tests. | PENDING APPROVAL |
| **CLN-05** | **MEDIUM**| **Frontend Route Guards & `can()` Context**: `CommunityScopeGuard` flashes content before redirect; `can()` evaluates permissions across union of all communities. | `frontend/components/rbac/guards.tsx`<br>`frontend/hooks/use-rbac.ts` | Add early return loading state in route guards. Update `can()` to evaluate effective permissions strictly for the active community scope. | Permission hook unit tests with active community switching. | PENDING APPROVAL |

---

## 3. Verification & Quality Gates

Before declaring remediation complete, the following verification pipeline will execute:

1. **Backend Test Suite**: `venv/Scripts/python.exe -m pytest` (100% pass)
2. **Frontend Test Suite**: `npx vitest run` (100% pass)
3. **TypeScript & Linting**: `npx tsc --noEmit` & `ruff check .`
4. **Security & Regression Suite**: `pytest app/modules/*/tests/` & `test_remediation_critical.py`
5. **OpenAPI Validation**: Generate & validate `openapi.json` completeness against all routes.

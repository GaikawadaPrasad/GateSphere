# GateSphere – Super Admin / Community Admin Issue Analysis

**Document Version:** 1.0  
**Date:** September 16, 2026  
**System:** GateSphere Enterprise (GSE-2026)  

---

## Executive Overview

This analysis document covers the inspection and root cause identification for five critical operational issues reported in the GateSphere Super Admin and Community Admin modules. Each issue has been investigated across the complete stack: Frontend (Next.js/React/TypeScript), Backend (FastAPI/Python/SQLAlchemy), Database (PostgreSQL/Supabase), and Security/RBAC context.

---

## Detailed Issue Analysis

### Issue 1: Multi-Role / Multi-Tab Session Ambiguity ("Multiple role sessions present")

* **Exact Affected Frontend File(s):**
  * [`frontend/lib/api.ts`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/lib/api.ts) (`getActiveRole`, `getCsrfToken`, `apiGet`, `apiSend`, `apiList`)
  * [`frontend/hooks/use-auth.ts`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/hooks/use-auth.ts) (`useMe`, `useLogout`)
* **Exact Affected Backend File(s):**
  * [`backend/app/core/security.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/core/security.py) (`_select_session_token`, `_requested_bucket`)
  * [`backend/app/modules/auth/service.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/auth/service.py) (`logout`)
* **Exact API Endpoint:** `/api/v1/auth/me` and all `/api/v1/*` endpoints
* **HTTP Method:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
* **Request:** Request from a browser carrying multiple role session cookies (e.g., `gatesphere_superadmin_session` and `gatesphere_community_admin_session`) without a matching `X-Session-Role` header.
* **Actual Response:**
  ```json
  {
    "success": false,
    "message": "Multiple role sessions present — set the X-Session-Role header",
    "data": null,
    "error": { "code": "AMBIGUOUS_SESSION" }
  }
  ```
* **Root Cause:**
  1. `getActiveRole()` in `frontend/lib/api.ts` relied on URL pathname prefix matching, `localStorage.getItem("gatesphere_active_role")` (which is shared across all tabs in the same browser origin), or matching the first session cookie found in `document.cookie`.
  2. When Tab 1 was logged in as Super Admin and Tab 2 was logged in as Community Admin, logging into Tab 2 overwrote `gatesphere_active_role` in `localStorage`.
  3. Subsequent requests or refetches from Tab 1 sent `X-Session-Role: community_admin` or omitted the header, causing backend `_select_session_token` in `security.py` to reject the request with `AMBIGUOUS_SESSION` (401/400).
  4. `useMe` in `use-auth.ts` re-threw non-401 errors, displaying a console error and breaking the session state.
  5. `useLogout` cleared shared `localStorage` state instead of revoking only the active role session cookie.
* **Proposed Fix:**
  1. Refactor `getActiveRole()` in `frontend/lib/api.ts` to strictly derive active role from current tab URL pathname first (`/super-admin/...`, `/community-admin/...`, etc.).
  2. Update `getCsrfToken()` to look up the exact CSRF cookie for the resolved tab role.
  3. Ensure all API calls (`apiGet`, `apiSend`, `apiList`) attach `X-Session-Role` header deterministically.
  4. Update `logout` to destroy only the presented role session bucket cookie without invalidating other active role cookies in the browser.
* **Security Impact:** Zero degradation. Server-side session validation and tenant isolation remain intact. Eliminates cross-tab session leakage.
* **Regression Risk:** Low.
* **Test Required:** `backend/tests/test_auth_session.py` (multi-role session isolation), frontend tab isolation test.

---

### Issue 2: Newly Created Community Admin Dashboard 501 Errors

* **Exact Affected Frontend File(s):**
  * [`frontend/app/community-admin/dashboard/page.tsx`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/app/community-admin/dashboard/page.tsx)
  * [`frontend/hooks/use-communities.ts`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/hooks/use-communities.ts)
  * [`frontend/hooks/use-dashboards.ts`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/hooks/use-dashboards.ts)
* **Exact Affected Backend File(s):**
  * [`backend/app/modules/dashboards/router.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/dashboards/router.py)
  * [`backend/app/modules/dashboards/service.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/dashboards/service.py)
  * [`backend/app/core/tenancy.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/core/tenancy.py)
* **Exact API Endpoint(s):**
  * `GET /api/v1/dashboards/overview`
  * `GET /api/v1/dashboards/financial`
  * `GET /api/v1/communities/{community_id}`
* **HTTP Method:** `GET`
* **Request:** Query with missing or unassigned `community_id` for a newly provisioned Community Admin.
* **Actual Response:** `HTTP 501 Not Implemented` or `HTTP 404/403` unhandled scope exception.
* **Root Cause:**
  1. Provisioning a new Community Admin creates a `UserRole` linked to `community_id`. If `activeCommunityId` in `useUiStore` was unset or `undefined` on initial login, API requests were sent with `community_id=undefined`.
  2. Backend tenant scope dependency (`get_tenant_scope_async`) failed to resolve active community when `x_community_id` was missing and multiple grants or ambiguous scopes existed.
  3. Any unhandled or mock dashboard queries returned 501 or fallback error responses.
* **Proposed Fix:**
  1. Guarantee `provision_community_admin` in backend provisions `UserRole` with explicit `community_id`.
  2. Ensure frontend `useUiStore` automatically sets `activeCommunityId` from `currentUser.community_ids[0]` upon initial authentication.
  3. Verify all dashboard endpoints (`GET /dashboards/overview`, `GET /dashboards/financial`) execute cleanly and return standard `ApiResponse` envelope with `200 OK`.
* **Security Impact:** Enforces strict tenant scope binding.
* **Regression Risk:** Low.
* **Test Required:** Community Admin creation and login dashboard load test.

---

### Issue 3: Announcement "Expire" -> "Expired" State Persistence

* **Exact Affected Frontend File(s):**
  * [`frontend/app/community-admin/communication/page.tsx`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/app/community-admin/communication/page.tsx)
  * [`frontend/types/communication.ts`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/types/communication.ts)
* **Exact Affected Backend File(s):**
  * [`backend/app/modules/communication/service.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/communication/service.py)
  * [`backend/app/modules/communication/router.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/communication/router.py)
  * [`backend/app/modules/communication/schemas.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/communication/schemas.py)
* **Exact API Endpoint:** `POST /api/v1/communication/announcements/{announcement_id}/expire`
* **HTTP Method:** `POST`
* **Request:** Path parameter `announcement_id`
* **Actual Response:** `200 OK` with updated announcement object (where `expires_at` is set to current timestamp).
* **Root Cause:**
  1. Backend `expire_announcement` correctly updated `ann.expires_at = datetime.now(UTC)`.
  2. Frontend table column rendering in `communication/page.tsx` checked ONLY `a.is_published` (`a.is_published ? "Published" : "Draft"`), completely ignoring `expires_at`.
  3. The Action column rendered `<button onClick={() => handleExpire(a.id)}>Expire</button>` whenever `a.is_published` was true, ignoring whether `expires_at` was set in the past.
  4. On page refresh, the table re-read `is_published` and continued showing "Published" and the "Expire" button.
* **Proposed Fix:**
  1. Ensure backend `AnnouncementRead` schema includes `expires_at` and `is_expired` helper (or evaluate `expires_at <= now`).
  2. Make `expire_announcement` service call idempotent (if already expired, return updated model cleanly).
  3. Update frontend `communication/page.tsx`:
     * Status column: If `expires_at` is in past, display badge `<span className="badge badge-neutral">Expired</span>`.
     * Action column: If expired, display `<span className="badge badge-neutral">Expired</span>` (or a disabled button) instead of the active `Expire` button.
* **Security Impact:** Permission `communication:update` enforced. Safe state transition.
* **Regression Risk:** None.
* **Test Required:** Test announcement publish -> expire -> refresh page -> verify `Expired` state persists.

---

### Issue 4: Operations Returning HTTP 404 Instead of HTTP 200

* **Exact Affected Frontend File(s):**
  * [`frontend/lib/api.ts`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/lib/api.ts)
  * Dashboard/Admin page files
* **Exact Affected Backend File(s):**
  * [`backend/app/modules/communities/router.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/communities/router.py)
  * [`backend/app/modules/residents/router.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/residents/router.py)
  * [`backend/app/core/tenancy.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/core/tenancy.py)
* **Exact API Endpoint(s):** Various community-scoped GET/POST endpoints
* **HTTP Method:** `GET`, `POST`
* **Root Cause:**
  1. Requests missing `X-Community-Id` or using wrong route parameters caused `TenantScope.require(community_id)` to throw `NotFoundError("Resource not found")` (which returns HTTP 404 by security design for cross-tenant or unbindable scope requests).
  2. Frontend using obsolete API route paths.
* **Proposed Fix:**
  1. Ensure frontend API calls always attach valid `X-Community-Id` header for Super Admin and community scope for Community Admin.
  2. Fix route parameter bindings to use canonical backend routes.
* **Security Impact:** Preserves cross-tenant 404 isolation while fixing valid intra-tenant requests to 200.
* **Regression Risk:** Low.
* **Test Required:** Backend API endpoint tests for community admin operations.

---

### Issue 5: Domestic Staff Registration Validation UX

* **Exact Affected Frontend File(s):**
  * [`frontend/app/community-admin/staff/page.tsx`](file:///c:/Users/win%2010/GateSphere_Internal/frontend/app/community-admin/staff/page.tsx)
* **Exact Affected Backend File(s):**
  * [`backend/app/modules/domestic_staff/router.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/domestic_staff/router.py)
  * [`backend/app/modules/domestic_staff/schemas.py`](file:///c:/Users/win%2010/GateSphere_Internal/backend/app/modules/domestic_staff/schemas.py)
* **Exact API Endpoint:** `POST /api/v1/staff`
* **HTTP Method:** `POST`
* **Request:** `StaffCreate` payload
* **Actual Response:** `HTTP 422 Unprocessable Entity` with `{ "error": { "code": "VALIDATION_ERROR", "fields": { "phone": "Invalid phone number", "email": "Invalid email address" } } }`
* **Root Cause:**
  1. `handleAddStaff` in `staff/page.tsx` caught validation errors and stored `err.message` in `errorMessage`, which rendered a single red alert banner at the top of the modal dialog (`⚠️ {errorMessage}`).
  2. `err.fields` returned by backend `ApiError` was not mapped to individual field error states (`staffFieldErrors`).
  3. Form inputs lacked field-level error messages, tooltip helpers, and accessibility attributes (`aria-invalid="true"`, `aria-describedby="..."`).
* **Proposed Fix:**
  1. Parse `err.fields` from `ApiError` in `handleAddStaff` and map each error key directly into `staffFieldErrors`.
  2. Render field-level error text, warning indicators, tooltips, and accessibility attributes (`aria-invalid="true"`, `aria-describedby="<field>-error"`) directly under/beside each input field.
  3. Use top-level `errorMessage` alert banner ONLY for unmapped/general server errors.
* **Security Impact:** None. Improves validation UX while keeping authoritative backend validation intact.
* **Regression Risk:** Low.
* **Test Required:** Frontend staff form validation test & backend staff creation validation test.

# Community Admin Dashboard API Audit

**Document Version:** 1.0  
**Date:** September 16, 2026  
**System:** GateSphere Enterprise (GSE-2026)  

---

## Executive Summary

This document lists all backend APIs triggered during initial page load and ongoing operational interactions on the **Community Admin Dashboard** (`/community-admin/dashboard`). Every API endpoint has been audited for standard envelope compliance, RBAC permission dependencies, community scope enforcement, and expected HTTP status codes.

---

## Dashboard API Audit Matrix

| API Endpoint | HTTP Method | Purpose / Function | Permission Code | Community Scope Requirement | Expected Success Code | Status & Audit Result |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: |
| `/api/v1/auth/me` | `GET` | Resolve current user, role, permissions, & assigned community IDs | Authenticated User | Session / Token Context | `200 OK` | ✅ Passed |
| `/api/v1/communities/{id}` | `GET` | Fetch metadata & totals (towers/units/residents) for active community | `communities:view` | Target `community_id` in scope | `200 OK` | ✅ Passed |
| `/api/v1/communities/{id}/towers` | `GET` | List all residential towers in community | `communities:view` | Target `community_id` in scope | `200 OK` | ✅ Passed |
| `/api/v1/dashboards/overview` | `GET` | Retrieve aggregate counts (units, residents, pending visitors, open tickets, etc.) | `dashboards:view` | `community_id` required or derived | `200 OK` | ✅ Passed |
| `/api/v1/dashboards/financial` | `GET` | Retrieve total billed, collected, & outstanding maintenance balances | `billing:view` | `community_id` required or derived | `200 OK` | ✅ Passed |
| `/api/v1/staff` | `GET` | List registered staff members in community | `staff:view` | `community_id` filter applied | `200 OK` | ✅ Passed |
| `/api/v1/staff/attendance` | `GET` | Fetch daily staff gate check-ins & active presence | `staff:view` | `community_id` filter applied | `200 OK` | ✅ Passed |
| `/api/v1/incidents` | `GET` | List open security incidents & alert events | `incidents:view` | `community_id` filter applied | `200 OK` | ✅ Passed |
| `/api/v1/residents/move-records` | `GET` | Fetch requested resident move-in / move-out clearance passes | `residents:view` | `community_id` filter applied | `200 OK` | ✅ Passed |
| `/api/v1/communication/announcements` | `GET` | Fetch published community broadcasts & notices | `communication:view` | `community_id` filter applied | `200 OK` | ✅ Passed |

---

## Audit Notes & Scope Discipline

1. **No Redundant / Duplicate Calls:** The dashboard triggers only necessary KPI aggregations and widget feeds.
2. **Tenant Isolation:** Every request passes `X-Community-Id` or resolves `community_id` from the active role session.
3. **Response Envelope Compliance:** All endpoints return `{ "success": true, "message": "...", "data": {...}, "meta": {...} }`.

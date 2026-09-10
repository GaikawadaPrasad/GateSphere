# GateSphere Auditor Dashboard — Master Architecture & Specification

## 1. Overview & Purpose

The **Auditor Dashboard** is a strictly **read-only** governance and compliance console within GateSphere. It empowers internal compliance officers, financial auditors, and security inspectors to review historical trails, reconstruct user actions, audit gate entries/exits, inspect maintenance SLAs, review vendor passes, examine financial ledger transactions, and generate audit certificates without any possibility of modifying or altering records.

---

## 2. Design System & Visual Specification

- **Dashboard Accent Theme**: Governance Slate (`#475569`) & Trust Blue (`#1D4ED8`)
- **Typography**: Inter Font, Hero H1 (56px 900), Eyebrow (`AUDIT & COMPLIANCE CONSOLE`), animated stat counters (`useCountUp` over 1800ms)
- **Controls**: Multi-column sorting (`DataTable`), 300ms debounced search (`DebouncedInput`), client-side and server-side pagination with configurable page sizes (10, 25, 50, 100), CSV export engine.
- **Strict Read-Only Enforcement**: UI **never renders write/edit/delete buttons**. Backend responds with HTTP 403 on any mutation attempt.

---

## 3. Module Breakdown (11 Modules)

| #   | Module Name             | Primary Purpose                                  | Key Data Fields                                                     | API Endpoint                                        |
| --- | ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------- |
| 01  | **Dashboard Overview**  | Executive compliance summary & KPIs              | Integrity score, total audit logs, active incidents, ledger balance | `GET /dashboards/overview`, `GET /audit/logs`       |
| 02  | **Audit Logs**          | Immutable system-wide audit trail                | Timestamp, Actor, Module, Action, IP, Diff JSON                     | `GET /audit/logs`, `GET /audit/logs/{id}`           |
| 03  | **User Activity**       | User journey & session timeline reconstruction   | User ID, email, role, action sequence, timestamps                   | `GET /audit/logs?user_id={id}`                      |
| 04  | **Gate Activity**       | Gate entry/exit log & security anomalies         | Gate name, vehicle plate, RFID token, guard on duty                 | `GET /gate/events`                                  |
| 05  | **Visitor Records**     | Visitor compliance & overstay logs               | Visitor name, phone, host unit, check-in, check-out                 | `GET /visitors/requests`                            |
| 06  | **Maintenance Records** | Ticket lifecycle & SLA compliance                | Ticket #, category, priority, time to resolve, technician           | `GET /complaints/tickets`                           |
| 07  | **Vendor Activity**     | Vendor access badges & work proofs               | Vendor company, pass ID, authorized units, entry/exit               | `GET /visitors/requests?category=vendor`            |
| 08  | **Incident Records**    | Security alarm & panic resolution audit          | Incident ID, severity, responder, resolution notes                  | `GET /gate/alerts`                                  |
| 09  | **Financial Records**   | Read-only ledger, invoice & payment audit        | Invoice #, billed amount, collected amount, balance                 | `GET /billing/invoices`, `GET /billing/payments`    |
| 10  | **Reports**             | Formal audit certificates & compliance summaries | Compliance rating, period, findings, signature block                | `GET /audit/reports/summary`, `GET /audit/logs.csv` |
| 11  | **Audit Search**        | Cross-module global search with filters          | Module, date range, user, free text keyword                         | `GET /audit/logs?search={q}`                        |

---

## 4. API Integration & Envelope Architecture

All calls use the canonical envelope structure:

```json
{
  "success": true,
  "message": "Logs retrieved successfully",
  "data": [...],
  "meta": {
    "total": 420,
    "page": 1,
    "page_size": 10,
    "pages": 42
  }
}
```

Authentication utilizes secure `HttpOnly` cookies (`gs_session`) and double-submit CSRF headers (`X-CSRF-Token`).

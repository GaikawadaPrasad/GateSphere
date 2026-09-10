# GateSphere Owner / Tenant Dashboard — Master Architecture & Specification

## 1. Overview & Purpose

The **Owner / Tenant Dashboard** is the primary resident self-service hub in GateSphere. It empowers homeowners and tenants to control gate security, instantly approve or deny arriving visitors in real time (with a 2-minute countdown timer), issue pre-approved QR passes, configure standing gate delivery rules, book community amenities, raise maintenance tickets with technician chat, register vehicles, manage domestic staff, pay maintenance dues via a simulated payment gateway, and trigger emergency SOS alarms.

---

## 2. Design System & Visual Specification

- **Dashboard Accent Theme**: Trust Blue (`#1D4ED8`) & Fresh Teal (`#0D9488`)
- **Typography**: Inter Font, Hero H1 (56px 900), Eyebrow (`OWNER & TENANT HOME CONSOLE`), Live Status Dot (`GATE RECOGNITION LIVE`)
- **Real-Time Interactive Banner**: Vibrant gradient prompt (`#1E40AF` to `#1D4ED8`) with live ticking timer for incoming visitor approvals.
- **Modals & Forms**: Clean modal dialogs for guest pass creation, amenity reservation, service ticket submission, and checkout receipt preview.

---

## 3. Module Breakdown (14 Modules)

| #   | Module Name            | Primary Purpose                           | Key Data Fields                                                 | API Endpoint                                                      |
| --- | ---------------------- | ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| 01  | **Dashboard Overview** | Resident glance view & live alerts        | Outstanding dues, active visitor banner, open tickets, bookings | `GET /dashboards/resident`, `GET /billing/invoices`               |
| 02  | **My Profile**         | Personal & emergency contacts             | Name, email, mobile phone, emergency contact                    | `GET /auth/me`, `PATCH /residents/me`                             |
| 03  | **My Property**        | Tenancy & apartment details               | Unit #, tower, floor, sq.ft, ownership status, parking spot     | `GET /residents/property`                                         |
| 04  | **Family Members**     | Gate whitelist for household members      | Name, relation, phone, photo, gate pre-approval status          | `GET /residents/family`, `POST /residents/family`                 |
| 05  | **Visitors**           | Real-time approval & QR pass generator    | Visitor name, phone, purpose, pass code, timer, decision        | `GET /visitors/requests`, `POST /visitors/requests/{id}/decision` |
| 06  | **Deliveries**         | Standing gate rules & parcel tracker      | Courier company, package type, tracking ID, standing rule       | `GET /deliveries`, `PUT /deliveries/protocols`                    |
| 07  | **Amenities**          | Facility slot browser & booking           | Facility name, hourly price, date picker, booking slot          | `GET /amenities`, `POST /amenities/bookings`                      |
| 08  | **Maintenance**        | Community upkeep & utility notices        | Notice title, date/time, affected towers, description           | `GET /announcements?category=maintenance`                         |
| 09  | **Complaints**         | Service desk tickets & chat               | Ticket #, subject, category, priority, SLA status               | `GET /complaints/tickets`, `POST /complaints/tickets`             |
| 10  | **Vehicles**           | Vehicle registration & parking allocation | License plate, make/model, parking spot, RFID tag, violations   | `GET /vehicles`, `POST /vehicles`                                 |
| 11  | **Domestic Staff**     | Assigned staff & gate attendance          | Staff name, service type, phone, police verified, gate presence | `GET /domestic-staff/assignments`                                 |
| 12  | **Payments**           | Dues ledger, checkout & receipt           | Invoice #, description, total, balance, simulated pay, receipt  | `GET /billing/invoices`, `POST /billing/payments`                 |
| 13  | **Notifications**      | Community broadcasts & alerts             | Notification title, message, timestamp, unread indicator        | `GET /notifications`                                              |
| 14  | **Emergency SOS**      | High-priority guard panic alarm           | Unit coordinates, resident phone, emergency note                | `POST /gate/alerts`                                               |

---

## 4. API Integration & Payment Ledger Architecture

- Simulated checkout automatically generates an official receipt formatted as `RCP-{YEAR}-{RANDOM_4_DIGIT}`.
- Visitor pass generator issues both a 4-digit PIN and digital QR token valid for configurable durations (6h, 12h, 24h, 72h).
- Real-time visitor approval allows one-click approval or rejection with immediate websocket/polling sync to guard tablet.

# GateSphere Domestic Staff Dashboard — Master Architecture & Specification

## 1. Overview & Purpose
The **Domestic Staff Dashboard** is an operational daily mobile and web console for domestic helpers, housekeepers, cooks, drivers, and caregivers working across residential communities in GateSphere. It delivers rapid, single-glance access to daily apartment assignments, shift schedules, automated gate attendance records, digital QR passes, resident ratings, and one-tap emergency SOS assistance.

---

## 2. Design System & Visual Specification
- **Dashboard Accent Theme**: Fresh Teal (`#0D9488`) & Trust Blue (`#1D4ED8`)
- **Typography**: Inter Font, Hero H1 (56px 900), Eyebrow (`STAFF PORTAL & DAILY WORK CONSOLE`), Live Status Dot (`DUTY CLOCK ACTIVE`)
- **Safety Elements**: Dedicated high-visibility red SOS panic button (`#DC2626`) transmitting GPS/unit coordinates directly to Security Guard stations.
- **Controls**: Clean cards with `.card-hover` lift, debounced search, modal dialogs for contact editing, digital QR pass rendering.

---

## 3. Module Breakdown (9 Modules)

| # | Module Name | Primary Purpose | Key Data Fields | API Endpoint |
|---|---|---|---|---|
| 01 | **Dashboard Overview** | Daily duty snapshot & quick actions | Assigned units count, duty clock, star rating, police verification | `GET /domestic-staff/me`, `GET /domestic-staff/assignments` |
| 02 | **My Profile** | Verified profile & contact editor | Full name, phone, emergency contact, locked police verification ID | `GET /domestic-staff/me`, `PATCH /domestic-staff/{id}` |
| 03 | **Assigned Homes** | List of all assigned apartments & contacts | Unit #, tower, floor, resident name, phone, instructions | `GET /domestic-staff/assignments` |
| 04 | **Schedule** | Weekly shift timetable & reminders | Day of week, scheduled hours per unit, total daily hours | `GET /domestic-staff/schedules` |
| 05 | **Attendance** | Gate-synced working hours log | Date, gate used, check-in, check-out, duration | `GET /domestic-staff/attendance` |
| 06 | **Entry / Exit** | Digital QR token & live pass | Pass ID, QR token, current duty status, gate timestamp | `GET /domestic-staff/passes` |
| 07 | **Visits** | Historical log of unit visits & ratings | Unit, date, work performed, resident rating & review | `GET /domestic-staff/visits` |
| 08 | **Notifications** | Alert center for updates & notices | Schedule changes, new ratings, community gate notices | `GET /notifications` |
| 09 | **Emergency SOS** | One-tap guard alarm dispatch | Panic coordinates, current unit, timestamp, guard alert | `POST /gate/alerts` |

---

## 4. API Integration & Security Protocol
- Police verification status and government identity references are **admin-locked** to maintain security compliance.
- Gate attendance timestamps are auto-populated directly from Gate Security checkpoints and cannot be edited by staff.
- Emergency SOS requests transmit with high priority (`priority: "high"`) directly waking on-duty security guard tablets.

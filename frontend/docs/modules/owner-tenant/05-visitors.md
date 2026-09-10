# Owner / Tenant Module 05: Visitors

## Purpose

Provides interactive real-time gate visitor approvals (complete with ticking 2-minute countdown timer), pre-approved guest pass creation (generating 4-digit PINs and QR tokens), and full historical visitor records.

## Key Data Fields

- `visitor_name`: Full name of guest (`Robert Langdon`)
- `phone`: Guest contact number (`+1 (555) 234-5678`)
- `purpose`: Reason for visit (`Guest / Dinner`)
- `status`: `pending`, `approved`, `rejected`, `expired`
- `pass_code`: Generated PIN / OTP (`OTP-8819`)
- `entry_time`: Actual gate entry timestamp

## API Endpoints

- `GET /api/v1/visitors/requests`
- `POST /api/v1/visitors/requests`
- `POST /api/v1/visitors/requests/{id}/decision`
- `POST /api/v1/visitors/requests/{id}/passes`

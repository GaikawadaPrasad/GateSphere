# Owner / Tenant Module 11: Domestic Staff

## Purpose
Enables homeowners to browse verified staff rosters, assign housekeepers/cooks/drivers to their apartment, monitor their live daily gate attendance, and submit monthly ratings.

## Key Data Fields
- `name`: Staff member full name (`Anita Sharma`)
- `role`: Service category (`Housekeeping & Cooking`)
- `phone`: Contact phone number
- `police_verified`: Verification badge (`Verified`)
- `status`: Live gate presence today (`checked_in`, `checked_out`)

## API Endpoints
- `GET /api/v1/domestic-staff/assignments`
- `POST /api/v1/domestic-staff/assignments`
- `DELETE /api/v1/domestic-staff/assignments/{id}`

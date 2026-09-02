# Owner / Tenant Module 04: Family Members

## Purpose
Allows household owners to whitelist family members so they can enter gates via facial recognition or mobile pass without generating visitor approval phone calls.

## Key Data Fields
- `name`: Family member full name (`Rajesh Mehta`, `Priya Mehta`, `Aarav Mehta`)
- `relation`: Relationship (`Self / Owner`, `Co-Owner / Spouse`, `Son`)
- `phone`: Mobile number for intercom routing
- `gate_access`: Pre-approved gate whitelist badge

## API Endpoints
- `GET /api/v1/residents/family`
- `POST /api/v1/residents/family`
- `DELETE /api/v1/residents/family/{id}`

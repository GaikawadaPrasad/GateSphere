# Owner / Tenant Module 03: My Property

## Purpose
Displays unit specifics, tower location, built-up area, tenancy status (owner-occupier vs tenant), lease agreement validity, and assigned basement parking spots.

## Key Data Fields
- `unit_number`: Apartment number (`Unit A-402`)
- `tower_name`: Residential tower (`Emerald Tower`)
- `occupancy_type`: Ownership type (`Owner (Primary Resident)`)
- `super_built_up_area`: Square footage (`1,850 sq.ft (3 BHK + Balcony)`)
- `allocated_parking`: Assigned slot number (`Slot B1-104 (EV Ready)`)

## API Endpoints
- `GET /api/v1/residents/property`

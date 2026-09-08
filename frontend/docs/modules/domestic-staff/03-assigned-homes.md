# Domestic Staff Module 03: Assigned Homes

## Purpose
Displays all resident apartments to which the staff member is actively assigned, including homeowner names, direct phone links, and special household instructions.

## Key Data Fields
- `unit_number`: Apartment identifier (`A-402`, `B-701`)
- `tower_name`: Residential tower name (`Emerald Tower`)
- `floor`: Level number (`4`)
- `resident_name`: Homeowner / tenant primary name (`Priya & Rajesh Mehta`)
- `resident_phone`: Click-to-call mobile number
- `special_instructions`: Household notes (e.g., `Key under plant pot on Tuesdays`)

## API Endpoints
- `GET /api/v1/domestic-staff/assignments`

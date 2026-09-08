# Domestic Staff Module 07: Visits & Ratings

## Purpose
Maintains a historical record of all completed household visits, tasks accomplished, and star feedback submitted by residents.

## Key Data Fields
- `unit`: Served apartment (`A-402`, `B-701`)
- `date`: Service date
- `duration`: Time spent on site (`3h 00m`)
- `tasks_performed`: Work summary (`Deep kitchen cleaning`)
- `rating`: Resident score (`5.0 ⭐`)
- `feedback`: Resident comment string (`Punctual and very thorough!`)

## API Endpoints
- `GET /api/v1/domestic-staff/visits`

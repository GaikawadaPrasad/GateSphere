# Domestic Staff Module 05: Attendance

## Purpose
Renders immutable gate attendance records auto-populated directly from security checkpoint entry and exit scans.

## Key Data Fields
- `date`: Shift date (`2026-09-02`)
- `check_in_at`: Precise timestamp of gate entry (`08:02 AM`)
- `check_out_at`: Departure timestamp or `ONGOING` live pulse badge
- `gate_name`: Gate used (`Gate 1 Main Entrance`)
- `duration_minutes`: Accumulated working time in hours and minutes (`3h 5m`)
- `status`: `open` or `completed`

## API Endpoints
- `GET /api/v1/domestic-staff/attendance`

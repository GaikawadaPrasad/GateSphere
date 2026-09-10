# Domestic Staff Module 04: Schedule

## Purpose

Renders the weekly shift timetable broken down by individual unit time-slots, with visual badges indicating hours allocation per day.

## Key Data Fields

- `day_of_week`: Monday through Sunday
- `time_slots`: Array of scheduled intervals (e.g. `08:00 AM – 11:00 AM`)
- `assigned_unit`: Target unit for that slot
- `total_daily_hours`: Calculated working duration (`5.5 Hours Total`)

## API Endpoints

- `GET /api/v1/domestic-staff/schedules`

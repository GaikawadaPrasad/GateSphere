# Owner / Tenant Module 08: Maintenance

## Purpose

Informs residents about upcoming common-area maintenance activities, scheduled water tank cleanings, generator backup tests, and elevator overhauls.

## Key Data Fields

- `title`: Notice title (`Overhead Water Tank Cleaning`)
- `affected_areas`: Impacted towers or common facilities
- `scheduled_time`: Start and end maintenance interval
- `description`: Instructions for residents (e.g. water conservation during works)

## API Endpoints

- `GET /api/v1/announcements?category=maintenance`

# Domestic Staff Module 08: Notifications

## Purpose
Alerts staff to new review submissions, homeowner schedule requests, holiday schedules, and general estate notices.

## Key Data Fields
- `title`: Alert headline
- `description`: Detailed text
- `timestamp`: Relative time string (`2 hours ago`, `Yesterday`)
- `category`: `rating`, `schedule`, `community_notice`

## API Endpoints
- `GET /api/v1/notifications`

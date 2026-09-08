# Owner / Tenant Module 13: Notifications

## Purpose
Provides an inbox and live feed for billing invoices, visitor arrivals, amenity reservation confirmations, service ticket updates, and general estate notices.

## Key Data Fields
- `title`: Notification headline
- `description`: Detailed notice body
- `timestamp`: Relative arrival time (`1 day ago`, `2 days ago`)
- `category`: `billing`, `visitors`, `amenities`, `maintenance`

## API Endpoints
- `GET /api/v1/notifications`

# Owner / Tenant Module 07: Amenities

## Purpose

Allows residents to browse community recreational facilities (pool, clubhouse, tennis court), check live slot availability, make instant reservations, and cancel upcoming bookings.

## Key Data Fields

- `amenity_name`: Facility title (`Infinity Swimming Pool`, `Clubhouse Banquet Hall`)
- `category`: `Sports & Recreation`, `Events`
- `price_per_hour`: Decimal rate ($0.00 for free amenities, $50.00/hr for clubhouse)
- `date`: Selected reservation date
- `time_slot`: Reserved window (`07:00 AM – 08:30 AM`)
- `status`: `confirmed`, `cancelled`, `completed`

## API Endpoints

- `GET /api/v1/amenities`
- `GET /api/v1/amenities/bookings?mine=true`
- `POST /api/v1/amenities/bookings`
- `POST /api/v1/amenities/bookings/{id}/cancel`

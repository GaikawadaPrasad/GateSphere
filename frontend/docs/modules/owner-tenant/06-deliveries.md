# Owner / Tenant Module 06: Deliveries

## Purpose
Enables residents to configure standing gate delivery protocols by category (e.g. Allow food delivery without intercom call, leave packages at gate reception desk, require approval for high-value items) and track parcel arrivals.

## Key Data Fields
- `courier_company`: Platform/Courier (`Amazon Express`, `FedEx Priority`)
- `package_type`: Parcel description (`Electronics`, `Groceries`)
- `tracking_id`: Courier tracking ID (`AMZ-9921-US`)
- `protocol`: `allow_gate`, `leave_at_desk`, `require_approval`, `reject`
- `status`: `expected`, `at_gate`, `delivered`, `collected`

## API Endpoints
- `GET /api/v1/deliveries`
- `PUT /api/v1/deliveries/protocols`

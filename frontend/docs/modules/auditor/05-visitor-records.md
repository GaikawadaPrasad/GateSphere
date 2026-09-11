# Auditor Module 05: Visitor Records

## Purpose

Verifies visitor access compliance, detects visitor overstays beyond approved windows, and audits OTP/QR pass authorizations.

## Key Data Fields

- `visitor_name`: Full name of guest
- `phone`: Contact mobile number
- `host_unit`: Target destination apartment
- `purpose`: Reason for visit
- `entry_time`: Actual physical entry timestamp
- `exit_time`: Departure timestamp
- `overstay_flag`: Boolean flag indicating stay exceeded approval window

## API Endpoints

- `GET /api/v1/visitors/requests`
- `GET /api/v1/visitors/overstays`

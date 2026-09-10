# Auditor Module 07: Vendor Activity

## Purpose

Inspects contractor and third-party vendor entry passes, identity verification records, authorized work units, and photographic proof-of-work upon completion.

## Key Data Fields

- `vendor_company`: Name of registered contracting firm
- `technician_name`: Individual technician on premises
- `badge_id`: Temporary gate access badge issued
- `authorized_units`: Comma-separated list of permitted apartments
- `entry_timestamp`: Gate scan-in time
- `exit_timestamp`: Gate scan-out time

## API Endpoints

- `GET /api/v1/visitors/requests?category=vendor`
- `GET /api/v1/vendors`

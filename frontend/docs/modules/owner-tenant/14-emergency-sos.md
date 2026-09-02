# Owner / Tenant Module 14: Emergency SOS

## Purpose
Provides a prominent one-tap panic button for homeowners and tenants to instantly alert the Security Gate Station and initiate emergency response protocols.

## Key Data Fields
- `alert_type`: `sos`
- `priority`: `high`
- `unit_id`: Registered residential apartment (`Unit A-402, Emerald Tower`)
- `details`: Custom resident distress note or standard panic trigger

## API Endpoints
- `POST /api/v1/gate/alerts`

## Workflow
1. Homeowner clicks "One-Tap SOS" in header or on Emergency tab.
2. Confirmation dialog confirms unit location (`Unit A-402, Emerald Tower`).
3. Upon trigger, high-priority alarm is received by on-duty security guard stations and security supervisor.

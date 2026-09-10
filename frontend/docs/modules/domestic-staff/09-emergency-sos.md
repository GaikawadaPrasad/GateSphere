# Domestic Staff Module 09: Emergency SOS

## Purpose

Provides a prominent, high-reliability panic trigger that transmits the staff member's active unit location directly to on-duty security guard station screens.

## Key Data Fields

- `alert_type`: `sos`
- `priority`: `high`
- `current_location`: Active assigned unit name and tower coordinates
- `notes`: Emergency description or automated distress payload

## API Endpoints

- `POST /api/v1/gate/alerts`

## Workflow

1. Staff taps "One-Tap SOS" button.
2. Confirmation modal displays current location context.
3. Upon confirmation, high-priority alert is dispatched via HTTP POST and immediate incident record is logged in the security center.

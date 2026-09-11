# Domestic Staff Module 06: Entry / Exit

## Purpose

Generates a full-screen high-contrast QR gate pass token that staff present to guard tablets for contactless gate clearance.

## Key Data Fields

- `pass_code`: Alphanumeric pass token (`STAFF-PASS-8812`)
- `qr_data`: Encrypted verification payload for barcode scanner
- `duty_status`: Live on-duty indicator badge
- `current_checkin`: Active entry checkpoint timestamp

## API Endpoints

- `GET /api/v1/domestic-staff/passes`
- `POST /api/v1/domestic-staff/checkout`

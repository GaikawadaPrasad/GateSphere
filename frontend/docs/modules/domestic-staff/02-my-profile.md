# Domestic Staff Module 02: My Profile

## Purpose
Enables domestic staff to view their identity profile, update personal mobile number and family emergency contact, and view their tamper-locked government verification credentials.

## Key Data Fields
- `full_name`: Staff member legal name (`Anita Sharma`)
- `phone`: Contact phone number (User-editable)
- `emergency_contact`: Next-of-kin contact (User-editable)
- `service_type`: Role specialization (`Housekeeping & Cooking`)
- `police_verified`: Verification boolean (Admin-locked)
- `verification_id`: Official document certificate ID (Admin-locked)

## API Endpoints
- `GET /api/v1/domestic-staff/me`
- `PATCH /api/v1/domestic-staff/{id}`

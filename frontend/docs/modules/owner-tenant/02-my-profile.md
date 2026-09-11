# Owner / Tenant Module 02: My Profile

## Purpose

Enables residents to view and manage personal contact details, email preferences, and designated emergency contact persons.

## Key Data Fields

- `full_name`: Resident full name (`Priya & Rajesh Mehta`)
- `email`: Registered email address
- `phone`: Primary mobile number
- `emergency_contact`: Secondary emergency phone and relation

## API Endpoints

- `GET /api/v1/auth/me`
- `PATCH /api/v1/residents/me`

# Domestic Staff Module 01: Dashboard Overview

## Purpose

Provides an operational mobile console summarizing today's active apartment shift assignments, current gate check-in status, star rating summary, and immediate emergency SOS access.

## Key Data Fields

- `assigned_homes_today`: Integer count of units scheduled (`3`)
- `shift_status`: Gate recognition status (`Checked In` / `Checked Out`)
- `rating`: Average resident review score (`4.85 / 5.0`)
- `police_verification`: Locked verification indicator (`Verified`)

## API Endpoints

- `GET /api/v1/domestic-staff/me`
- `GET /api/v1/domestic-staff/assignments`

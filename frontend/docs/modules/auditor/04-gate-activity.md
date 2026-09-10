# Auditor Module 04: Gate Activity

## Purpose

Monitors physical perimeter security, barrier gate actuations, manual guard overrides, and RFID/license plate recognition accuracy.

## Key Data Fields

- `event_type`: `visitor_entry`, `visitor_exit`, `vehicle_entry`, `vehicle_exit`, `checkpoint_override`
- `gate_name`: Physical boom barrier gate identifier (Gate 1, Gate 2)
- `occurred_at`: ISO timestamp of gate passage
- `guard_on_duty`: Name of the security guard on the active roster
- `override_reason`: Required justification if manual gate bypass was triggered

## API Endpoints

- `GET /api/v1/gate/events`
- `GET /api/v1/gate/rosters`

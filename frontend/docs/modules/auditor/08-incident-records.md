# Auditor Module 08: Incident Records

## Purpose

Reviews security alerts, medical distress calls, panic alarms, fire sensor dispatches, and investigates guard response times and formal resolution filings.

## Key Data Fields

- `incident_id`: Unique tracking number (`INC-2026-081`)
- `severity`: Urgency classification (`low`, `medium`, `high`, `critical`)
- `location`: Affected unit, tower, or common area
- `alert_source`: Resident portal, domestic staff SOS, or perimeter sensor
- `response_time_seconds`: Interval between alert trigger and guard acknowledgment
- `resolution_summary`: Detailed notes entered by Security Supervisor

## API Endpoints

- `GET /api/v1/gate/alerts`
- `GET /api/v1/incidents`

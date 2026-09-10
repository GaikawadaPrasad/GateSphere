# Auditor Module 03: User Activity

## Purpose
Allows reconstruction of comprehensive user journeys and operational timelines to detect rogue administrator activities or account compromises.

## Key Data Fields
- `user_id`: UUID of the tracked user
- `email`: User registered email address
- `role`: Role slug at the time of execution
- `session_duration`: Time elapsed between login and logout
- `actions_count`: Total operations performed in session

## API Endpoints
- `GET /api/v1/audit/logs?user_id={id}`
- `GET /api/v1/users/{id}`

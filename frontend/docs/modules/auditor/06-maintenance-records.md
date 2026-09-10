# Auditor Module 06: Maintenance Records

## Purpose

Audits service tickets, repair requests, and technician SLA performance to ensure facility management meets contractual resolution time commitments.

## Key Data Fields

- `ticket_number`: Canonical ticket reference (`TKT-2026-101`)
- `category_name`: Maintenance trade (`Plumbing`, `Electrical`, `HVAC`)
- `priority`: Urgency level (`low`, `medium`, `high`, `emergency`)
- `assigned_to`: Vendor company or internal technician name
- `sla_status`: SLA compliance metric (`on_track`, `breached`, `resolved`)
- `time_to_resolution`: Total hours elapsed between ticket creation and resident sign-off

## API Endpoints

- `GET /api/v1/complaints/tickets`
- `GET /api/v1/complaints/categories`

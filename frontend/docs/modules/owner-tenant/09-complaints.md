# Owner / Tenant Module 09: Complaints & Service Desk

## Purpose
Provides a ticketing portal for residents to submit household maintenance issues (plumbing, electrical, carpentry), track resolution progress, view SLA status, and confirm resolution with star feedback.

## Key Data Fields
- `ticket_number`: Canonical reference (`TKT-2026-101`)
- `subject`: Summary description (`Water seepage in master bathroom ceiling`)
- `category_name`: Domain trade (`Plumbing`)
- `priority`: `low`, `medium`, `high`, `emergency`
- `status`: `open`, `assigned`, `in_progress`, `resolved`, `closed`
- `assigned_to`: Assigned maintenance team or vendor name

## API Endpoints
- `GET /api/v1/complaints/tickets`
- `POST /api/v1/complaints/tickets`
- `POST /api/v1/complaints/tickets/{id}/confirm`

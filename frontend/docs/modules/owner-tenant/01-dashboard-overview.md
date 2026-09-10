# Owner / Tenant Module 01: Dashboard Overview

## Purpose
Acts as the central cockpit for residents, highlighting urgent actionable items such as pending gate visitor approvals (with live 2-minute countdown timer), outstanding maintenance balances, active service tickets, and quick action shortcuts.

## Key Data Fields
- `pending_dues_amount`: Decimal balance ($350.00)
- `pending_visitor_count`: Live gate approval queue counter (1)
- `open_service_tickets`: Active maintenance tickets count (2)
- `staff_on_duty_count`: Domestic staff checked in today (2)

## API Endpoints
- `GET /api/v1/dashboards/resident`
- `GET /api/v1/billing/invoices`
- `GET /api/v1/visitors/requests`

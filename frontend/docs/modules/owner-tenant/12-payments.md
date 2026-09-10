# Owner / Tenant Module 12: Payments & Ledger

## Purpose

Displays current and historical maintenance invoices, breakdown of common area charges and sinking funds, enables simulated instant payment checkout, and renders official printable receipts formatted with `RCP-` numbering.

## Key Data Fields

- `invoice_number`: Billing reference (`INV-2026-0901`)
- `total_amount`: Full invoice total ($350.00)
- `balance_due`: Current outstanding balance
- `receipt_number`: Associated paid receipt (`RCP-2026-0814`)
- `line_items`: Breakdown of common area maintenance, security, and sinking fund charges

## API Endpoints

- `GET /api/v1/billing/invoices`
- `POST /api/v1/billing/payments`
- `GET /api/v1/billing/payments/{id}/receipt`

## Checkout & Receipt Workflow

1. Homeowner views unpaid invoice balance ($350.00).
2. Clicks "Pay Maintenance Dues Now" to open simulated checkout modal.
3. On submission, instant payment is recorded and official receipt (`RCP-{YYYY}-{RANDOM}`) is generated with print/save capabilities.

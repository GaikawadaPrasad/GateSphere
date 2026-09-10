# Auditor Module 09: Financial Records

## Purpose

Examines read-only community billing ledgers, maintenance invoice generations, simulated and gateway payment receipts, and audits account balance reconciliation.

## Key Data Fields

- `invoice_number`: Canonical invoice identifier (`INV-2026-0901`)
- `total_billed`: Total billed sum across common area charges and sinking funds
- `amount_paid`: Sum recorded in payment transactions
- `balance_due`: Remaining outstanding balance
- `receipt_number`: Associated official receipt number (`RCP-2026-0814`)
- `status`: Lifecycle state (`posted`, `paid`, `partially_paid`, `overdue`)

## API Endpoints

- `GET /api/v1/billing/invoices`
- `GET /api/v1/billing/payments`

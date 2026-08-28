# API — Maintenance & Billing (`/api/v1/billing`) — FR-09

Canonical envelope. All endpoints require a session; permission noted per row. Community-scoped
callers only see/act within their own community (else `404`). `?community_id=` is required for a
global caller on the collection routes; `PaymentCreate` carries `community_id` in the body.

## Endpoints

| Method & path | Permission | Body | Success | Notes |
|---|---|---|---|---|
| `GET /billing/health` | – (session) | – | `200` | liveness |
| `GET /billing/charge-heads` | `billing:view` | – | `200` list | `?community_id=` |
| `POST /billing/charge-heads` | `billing:approve` | `ChargeHeadCreate` | `201` single | `409 CHARGE_HEAD_EXISTS` |
| `PATCH /billing/charge-heads/{charge_head_id}` | `billing:approve` | `ChargeHeadUpdate` | `200` single | partial |
| `GET /billing/rules` | `billing:view` | – | `200` single | auto-creates the rule row |
| `PATCH /billing/rules` | `billing:approve` | `RuleUpdate` | `200` single | partial |
| `GET /billing/invoices` | `billing:view` | – | `200` list | `?unit_id=`, `?invoice_status=`, `?community_id=` |
| `POST /billing/invoices` | `billing:create` | `InvoiceCreate` | `201` single | totals computed server-side; `404` if unit outside scope |
| `GET /billing/invoices/{invoice_id}` | `billing:view` | – | `200` single | includes `items` |
| `POST /billing/invoices/{invoice_id}/post` | `billing:approve` | – | `200` single | `422 INVALID_TRANSITION` if not draft |
| `POST /billing/invoices/{invoice_id}/cancel` | `billing:approve` | – | `200` single | `422 INVOICE_HAS_PAYMENTS` / `INVALID_TRANSITION` |
| `GET /billing/payments` | `billing:view` | – | `200` list | `?community_id=` |
| `POST /billing/payments` | `billing:create` | `PaymentCreate` | `201` single | simulated; `422 ALLOCATION_MISMATCH` / `OVER_ALLOCATION` / `INVOICE_NOT_PAYABLE` |
| `GET /billing/payments/{payment_id}` | `billing:view` | – | `200` single | includes `allocations` |
| `GET /billing/units/{unit_id}/ledger` | `billing:view` | – | `200` list | newest first, monotonic `entry_seq` |

## Schemas (write — all `extra="forbid"`)

- **ChargeHeadCreate**: `code`, `name`, `calculation_type="flat"`, `default_amount=0`, `taxable=false`.
- **RuleUpdate**: `due_day?` (1–28), `grace_days?` (0–60), `late_fee_mode?`, `late_fee_value?`, `tax_percent?` (0–100), `allow_advance_payment?`.
- **InvoiceCreate**: `unit_id`, `billing_period_start?`, `billing_period_end?`, `issue_date?`, `due_date?`, `discount=0`, `items: [InvoiceLineCreate, …]` (≥ 1).
- **InvoiceLineCreate**: `description`, `charge_head_id?`, `quantity=1` (> 0), `unit_rate=0`, `taxable=false`.
- **PaymentCreate**: `amount` (> 0), `payment_method="upi"`, `payer_user_id?`, `allocations: [{invoice_id, amount}]` (≥ 1, must sum to `amount`), `remarks?`, `community_id?` (global caller).

## Error codes

`NOT_AUTHENTICATED` · `PERMISSION_DENIED` · `NOT_FOUND` · `VALIDATION_ERROR` · `INVALID_ENUM` ·
`COMMUNITY_REQUIRED` · `CHARGE_HEAD_EXISTS` · `INVALID_TRANSITION` · `INVOICE_HAS_PAYMENTS` ·
`ALLOCATION_MISMATCH` · `INVOICE_NOT_PAYABLE` · `OVER_ALLOCATION` · `CSRF_INVALID`.

## Audit

`charge_head.create`, `charge_head.update`, `rule.update`, `invoice.create`, `invoice.post`,
`invoice.cancel`, `payment.record`, `invoice.overdue` — written to `audit_logs` in the same
transaction. The financial trail also lives in `ledger_entries`.

## Scheduled jobs

- `billing.tasks.sweep_overdue_invoices` (daily 01:00) — `posted`/`partially_paid` invoices
  past `due_date` with a balance move to `overdue`; the resident is notified.
- `billing.tasks.send_dues_reminders` (Mon 09:00) — recurring reminder for every invoice
  still carrying a balance (not just on post).

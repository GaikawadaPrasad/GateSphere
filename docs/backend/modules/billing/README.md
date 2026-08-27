# Module: Maintenance & Billing (FR-09)

> Canonical spec for the `billing` module. Behaviour-changing code MUST update this file in the same PR.
> Status: **implemented** (2026-08-28).

## Purpose

Flat-wise **charge heads**, per-community **billing rules** (config-as-data), **maintenance
invoices** + line items, **simulated payments** + allocations, and an append-only per-unit
**ledger**. Sits on `communities` (units) and `residents` (primary occupant → billed user).

## Users & Permissions

| Action | Permission | Roles |
|--------|-----------|-------|
| View (invoices, payments, charge heads, rules, ledger) | `billing:view` | Super Admin, Community Admin, Association Committee, Resident, Auditor |
| Create invoice · record payment | `billing:create` | Super Admin, Community Admin, Association Committee, Resident |
| Edit charge heads / rules · post / cancel invoice | `billing:approve` | Super Admin, Community Admin, Association Committee |
| Export | `billing:export` | Association Committee, Auditor |

## Data model

Owned tables (`docs/database/schema.md §08`), migration `0012`. Money is `Numeric(12, 2)`.

| Table | Notes |
|-------|-------|
| `charge_heads` | UQ `(community_id, code)`, UQ `(id, community_id)`. `calculation_type` ∈ flat·per_sqft·per_unit·percentage. Tenant + RLS. |
| `billing_rules` | UQ `(community_id)` — config-as-data: `due_day`, `grace_days`, `late_fee_mode` (none·flat·percentage), `late_fee_value`, `tax_percent`, `allow_advance_payment`. Auto-created. |
| `maintenance_invoices` | Composite tenant-safe FK `(unit_id, community_id) → units`. UQ `(community_id, invoice_number)`, UQ `(id, community_id)`. `status` ∈ draft·posted·partially_paid·paid·overdue·cancelled. |
| `invoice_items` | Child of an invoice (no tenant column). `amount = quantity * unit_rate`. `metadata` JSONB. |
| `payments` | UQ `payment_reference`, `CHECK amount > 0`. **Simulated** — `gateway_name = "simulated"`, no external call. `payment_method` ∈ upi·card·netbanking·cash·cheque·wallet·adjustment. Tenant + RLS. |
| `payment_allocations` | UQ `(payment_id, invoice_id)`, `CHECK allocated_amount > 0`. |
| `ledger_entries` | **Append-only**. `entry_seq` (Postgres `Identity`) gives a monotonic order; `balance_after` is recomputed per unit from the previous entry. Tenant + RLS. |

## Business rules (service layer)

- Scoped to the caller's **active community** (`COMMUNITY_REQUIRED` otherwise). Cross-tenant
  unit / invoice → `404`.
- **Invoice totals**: `subtotal = Σ(qty × rate)`, `tax = Σ(taxable lines) × rule.tax_percent / 100`,
  `total = subtotal − discount + tax + late_fee`, `balance_due = total − amount_paid`. All
  quantised to 2 dp.
- A **draft** invoice can be cancelled; **posting** (`draft → posted`) freezes it and writes a
  ledger **debit**. Non-draft post → `422 INVALID_TRANSITION`.
- **Cancel**: refused if `amount_paid > 0` (`422 INVOICE_HAS_PAYMENTS`); a posted/overdue
  cancel writes a compensating ledger **credit**.
- **Payment** (simulated): allocations must **sum exactly** to `amount`
  (`422 ALLOCATION_MISMATCH`); each target invoice must be payable
  (`422 INVOICE_NOT_PAYABLE`) and the allocation must not exceed its balance
  (`422 OVER_ALLOCATION`). Each allocation advances the invoice
  (`posted → partially_paid → paid`) and writes a ledger **credit**.
- `ledger_entries` is never updated; `balance_after` is derived transactionally.
- Bad enum anywhere → `422 INVALID_ENUM`.

## API

Base path `/api/v1/billing`. Full contract: [`docs/backend/api/billing.md`](../../api/billing.md).
`/charge-heads`, `/rules`, `/payments`, `/units/{unit_id}/ledger` are declared **before** the
`/invoices/*` routes.

## Events

Audit (`audit_logs`, same transaction): `charge_head.create` / `charge_head.update`,
`rule.update`, `invoice.create`, `invoice.post`, `invoice.cancel`, `payment.record`. The
money trail also lives in `ledger_entries`.

## Seed

`seed_billing()` — a `billing_rules` row (18% tax) + 3 charge heads (MAINT / WATER / SINK)
per community.

## Tests

`app/modules/billing/tests/test_billing_unit.py` (invoice totals with tax, post → partial →
full payment + ledger balance, over-allocation, allocation-sum mismatch, cancel-with-payments)
and `test_billing_api.py` (health, auth gate, full admin invoice→post→pay lifecycle,
`billing:create` gate, cross-community 404).

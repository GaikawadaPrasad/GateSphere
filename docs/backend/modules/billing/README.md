# Module: Maintenance & Billing

> Canonical spec for the `billing` module. Behaviour-changing code MUST update this file in the same PR.

## Purpose
Charge heads, monthly invoices, penalties/late fees/discounts, advance payments, receipts, resident ledgers, outstanding reports.

## Users & Permissions
| Action | Roles allowed |
|--------|---------------|
| View   | _fill in_ |
| Create | _fill in_ |
| Update | _fill in_ |
| Delete | _fill in_ |
| Approve / special | _fill in_ |
| Export | Auditor, Community Admin, Super Admin |

## Data model
Owned tables: _list_. Every tenant table is scoped by `community_id`.

## Business rules
- _e.g._ finalized records are immutable
- _e.g._ concurrency-protected resources use `SELECT ... FOR UPDATE` / unique constraints

## State transitions
```
draft -> submitted -> approved -> closed
```

## API
Base path: `/api/v1/billing`. Contract: [`docs/backend/api/billing.md`](../../api/billing.md); OpenAPI at `/docs`.

## Events
- Emails / notifications: _list_
- Background jobs (Celery): `app/modules/billing/tasks.py`
- Audit events: _list_
- Cache invalidation: _list_

## Dependencies
Depends on: `communities`, `users`, `audit`, `notifications` (adjust).

## Failure scenarios
- _expected failures and recovery_

## Ownership
Backend owner: _TBD_ · Web owner: _TBD_ · Docs owner: _TBD_

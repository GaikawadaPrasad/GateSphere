# Stage 5 — State-Machine Audit + Test Isolation (fix mode)

**Date:** 2026-08-31

## Audited

Every lifecycle in `app/modules/*/service.py`: visitor request / entry / pass, complaint
ticket (+ SLA escalation sub-machine + resident-confirmation), delivery (status +
approval_status), amenity booking, security incident, invoice + payment, domestic-staff
verification + attendance + multi-unit assignment, guard roster + gate assignment + panic
alert, parking violation / allocation / slot, vehicle entry, resident profile + KYC + move
record, poll. 6 modules use the shared `ensure_transition` gate; the rest use explicit
`if status not in {...}` guards.

Full transition tables → **`docs/backend/STATE_MACHINES.md`** (new deliverable).

## Verdict

The **app-layer** state machines are correct — every documented valid transition works and
invalid ones raise `INVALID_TRANSITION` / `INVALID_STATE` (422). No unreachable required
state; no impossible state reachable through the API. But:

### SM-4 (INFO → FIXED) — no DB CHECK on 25+ status columns
Only `community_invitations.status` had a `CHECK`. `AGENTS.md §8` already *requires*
"Enumerations VARCHAR + CHECK" — the code just didn't. **Migration `0025`** adds
`CHECK (col IN (...))` to 25 lifecycle columns (values taken from each module's `ALLOWED`
set). Roundtrip-tested; clean `DROP SCHEMA → upgrade head → seed`; full suite green;
`test_state_machines.py::test_status_check_constraints_reject_impossible_state` proves a
raw out-of-enum INSERT is rejected.

### SM-1 (MEDIUM → FIXED) — `create_pass` approval bypass
`create_pass` (gated by `visitors:create`) flipped a `pending` request to `approved` when
issuing a pass — so a `visitors:create` holder who is **not** an approver and does **not**
occupy the unit could approve-by-proxy. Now the `pending → approved` side-effect fires only
when the actor `is_superadmin`, holds `visitors:approve`, **or** occupies the request's unit
(a resident pre-authorising their own guest — the legitimate case). Existing
`test_pass_issue_and_use` still passes (superadmin actor); new
`test_create_pass_does_not_auto_approve_for_non_approver` guards the fix.

### SM-2 (LOW, deferred) — visitor lifecycle is ad-hoc
Enforced by scattered `if status …` checks rather than one `_REQUEST_TRANSITIONS` map.
Correct today; documented in STATE_MACHINES.md; refactor deferred (no behaviour change, not
worth the risk mid-audit).

### SM-3 (LOW, note) — `payments.payment_status` only ever `success`
Payments are simulated (PRD). `failed`/`refunded` are CHECK-allowed but code never sets
them. Fine now; flagged for when a real gateway is wired.

## IS-1 (LOW → mitigated + documented) — shared-DB test isolation

**Cause determined (as required):** the integration suite runs against a **never-reset**
database; many tests `INSERT` without cleanup; `make up` seeds as an idempotent *top-up*.
After enough runs, seeded anchor rows get pushed past page 1 and pagination-bound assertions
fail (`test_communication_api.py::test_resident_sees_published_announcement` was the
observed "flake"). The Celery `beat` container's SLA/overdue/expiry sweeps against the same
DB add non-determinism.

**Fixes:**
- `make test` now runs `seed --reset` first and **stops `beat` + `worker`** for the run,
  then restarts them. `make test-fast` = old behaviour, documented as best-effort.
- Brittle page-1 assertion rewritten to page through (Stage 4).
- `docs/backend/TESTING.md` (new) documents the constraint and the rule for new tests
  (relative deltas / unique markers, never absolute counts).
- **Not done:** transactional per-test rollback fixtures (~250 API tests) — tracked as a
  larger follow-up; `make test` with reseed is the reliable entrypoint until then.

## Changes made

| File | Change |
|---|---|
| `backend/alembic/versions/0025_status_check_constraints.py` | **new** — 25 status `CHECK` constraints |
| `backend/app/modules/visitors/service.py` | SM-1: gate the pass pre-approval side-effect |
| `backend/tests/test_state_machines.py` | **new** — DB CHECK + representative transition + SM-1 tests |
| `Makefile` | `test` reseeds + pauses beat/worker; `test-fast` added |
| `docs/backend/STATE_MACHINES.md` | **new** deliverable — all transition tables |
| `docs/backend/TESTING.md` | **new** — IS-1 explanation + test rules |
| `docs/architecture/backend/modules/visitors.mmd` | `create_pass` node reflects SM-1 |
| `AGENTS.md` §10 | pointer to STATE_MACHINES.md + "extend the service map AND the CHECK" rule |

## Tests / commands executed

```
alembic upgrade head / downgrade -1 / upgrade head        → clean roundtrip (0025)
DROP SCHEMA public CASCADE → alembic upgrade head → seed  → OK (25 migrations from scratch)
ruff check . / black --check .                            → pass
pytest -q (fresh reseeded DB, Docker)                     → PYTEST_EXIT=0  (275 tests, 1 skip)
  test_status_check_constraints_reject_impossible_state    → raw bad INSERT rejected
  test_create_pass_does_not_auto_approve_for_non_approver  → pass
mermaid-cli validate visitors.mmd                        → valid
```

## Issue counts (this stage)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 (FIXED) | SM-1 |
| Low | 3 | SM-2 (deferred), SM-3 (note), IS-1 (mitigated) |
| Info | 1 (FIXED) | SM-4 |

# Stage 6 — Database Integrity Audit (fix mode)

**Date:** 2026-08-31

## Method

Live schema introspection (`pg_constraint`, `pg_index`, `pg_policies`) cross-checked against
`Base.metadata`; `alembic revision --autogenerate` drift analysis; clean-DB migration run.

## Verified sound

| Check | Result |
|---|---|
| Models ↔ tables | **1:1** — 0 models without a table, 0 tables without a model |
| Foreign keys | **194**, every one with an explicit `ON DELETE` — 128 `CASCADE`, 65 `SET NULL`, 1 `RESTRICT` (`service_tickets.category_id`, deliberate). No `NO ACTION`. |
| `audit_logs` | **no FKs** — append-only, survives user/community deletion (correct per AGENTS.md §10) |
| Row-Level Security | `tenant_isolation` policy on **56** tenant tables |
| Business-invariant partial-unique indexes | 5 present: one primary-active occupancy/unit, one active staff assignment/pair, one open attendance row/staff, one active parking allocation/slot **and** /vehicle |
| UNIQUE constraints | 66 |
| Clean-DB migration | `DROP SCHEMA → alembic upgrade head` → **27 migrations OK** → seed OK |
| Money columns | `NUMERIC` (no float); timestamps `TIMESTAMPTZ` |

## Findings & fixes

### DBI-1 (LOW→FIXED) — `managed_files.community_id` not indexed under RLS
`managed_files` carries the `tenant_isolation` policy → every query gets
`community_id IN (...)` appended, but the column had no index. **Migration `0026`** adds
`ix_managed_files_community_id`; model gets `index=True`.

### DBI-2 (LOW→FIXED) — `community_invitations` missing declared indexes
The model declares `status` and `unit_id` as `index=True`; migration `0023` created neither.
`list_invitations` filters by `status`. **Migration `0026`** adds
`ix_community_invitations_status` + `ix_community_invitations_unit_id`.

### DBI-3 (LOW→FIXED) — gate-entry race not atomically guarded
`record_entry` checks "no open entry for this request" in the service, but nothing stopped
two concurrent calls both inserting an `inside` row. **Migration `0026`** adds
`uq_visitor_entry_open` — a partial-unique on `visitor_entries(request_id) WHERE
status='inside'` (matching the pattern already used for occupancy / staff / parking). Model
`__table_args__` updated.

### DBI-4 (INFO→FIXED) — `alembic --autogenerate` produced ~140 lines of noise
- **~138 `alter_column(server_default=None)`**: models use Python-side `default=`; the early
  migrations *also* wrote an equivalent DB `server_default`. Both are correct and useful;
  autogenerate just wanted to drop the DB side. Fixed with a `compare_server_default`
  callback in `alembic/env.py` that ignores the diff when the model declares no
  `server_default` (columns that *do* declare one are still compared).
- **~5 index/constraint name mismatches** (`communities_code_key` vs `ix_communities_code`,
  `ix_payments_status` vs `ix_payments_payment_status`, `ix_staff_attendance_status`,
  `ix_community_invitations_email`, `community_invitations_token_hash_key`). **Migration
  `0027`** — pure renames + 2 unique-constraint→unique-index conversions (same columns, same
  uniqueness).

**Result: `alembic revision --autogenerate` now produces an empty migration** — the model
metadata and the live schema agree exactly.

### DBI-5 (INFO, accepted) — no `EXCLUDE` constraint for amenity-booking overlap
`book` uses `SELECT … FOR UPDATE` on the amenity row before the capacity sum, which is a
correct pessimistic guard (covered by `test_amenities_api.py`). A Postgres `EXCLUDE USING
gist (amenity_id WITH =, tstzrange(start_at,end_at) WITH &&)` would be the belt-and-braces
version but needs `btree_gist` and a schema change disproportionate to the risk. Noted.

## Changes made

| File | Change |
|---|---|
| `backend/alembic/versions/0026_db_integrity_indexes.py` | **new** — 3 indexes + 1 partial-unique |
| `backend/alembic/versions/0027_canonical_index_names.py` | **new** — align index names → clean autogenerate |
| `backend/alembic/env.py` | `_compare_server_default` callback |
| `backend/app/modules/uploads/models.py` | `community_id` `index=True` |
| `backend/app/modules/visitors/models.py` | `uq_visitor_entry_open` in `__table_args__` |

## Tests / commands executed

```
alembic upgrade head / downgrade -2 / upgrade head        → clean roundtrip (0026, 0027)
DROP SCHEMA public CASCADE → alembic upgrade head          → 27 migrations OK
python -m app.scripts.seed                                 → OK
alembic revision --autogenerate  (after 0026+0027+env fix) → 0 operations (empty)  ✅
ruff check . / black --check .                             → pass
pytest -q (fresh reseeded DB, Docker)                      → PYTEST_EXIT=0  (275 tests, 1 skip)
```

## Issue counts (this stage)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 3 (all FIXED) | DBI-1, DBI-2, DBI-3 |
| Info | 2 | DBI-4 (FIXED), DBI-5 (accepted) |

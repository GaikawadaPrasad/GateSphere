# Backend Testing

## Test types

| Layer | Files | Needs |
|---|---|---|
| Unit / service | `app/modules/*/tests/test_*_unit.py` | the `db` fixture (`backend/conftest.py`) — a savepoint-backed `AsyncSession`, rolled back at teardown; build the service directly with it. Fast, isolated (IS-2). |
| API integration | `app/modules/*/tests/test_*_api.py`, `tests/test_*.py` | the real Postgres + Redis + MinIO from `docker compose`, **seeded**. `TestClient` runs the app in its own event loop so it can't use the rollback `db` fixture — see IS-1. |
| RLS | `tests/test_tenant_isolation.py` | a `NOBYPASSRLS` DB role (created by the fixture) |
| Rate limiting | `tests/test_ratelimit.py` | Redis; re-enables the limiter locally (the suite disables it globally via `_disable_rate_limit`) |

## Run it

```bash
make test        # reseed a clean DB, stop beat/worker, run the full suite, restart them
make test-fast   # no reseed — quicker, but see IS-1 below
```

or directly:

```bash
docker compose exec -T backend pytest -q
```

## IS-1 — shared-DB test isolation

The integration suite runs against a **persistent** database and many tests `INSERT`
without cleanup. Over successive runs the DB accumulates rows, so:

- **pagination-bound assertions** (`any(x in page_1)`) start failing once a seeded anchor row
  is pushed past page 1 — this is the "flake" seen in earlier audit runs
  (`test_communication_api.py::test_resident_sees_published_announcement`).
- the Celery **`beat`** container fires SLA / overdue / expiry sweeps against the same DB
  every few minutes, which can move row counts mid-test.

**Mitigations in place**

1. `make test` runs `seed --reset` first (deterministic anchor data) and **stops
   `beat` + `worker`** for the duration.
2. Brittle "must be on page 1" assertions are being rewritten to page through or filter
   (done: the announcement test).
3. New tests must not assert on absolute counts or page-1 membership of non-seed data —
   use relative deltas (`>= before + 1`) or query by a unique marker.

## IS-2 — transactional per-test isolation

**Unit / service tests: done.** The shared `db` fixture (`backend/conftest.py`) is a
connection-bound `AsyncSession` with `join_transaction_mode="create_savepoint"` inside an
outer transaction that is rolled back at teardown. Writes never persist — even if the code
under test calls `.commit()` (it becomes a SAVEPOINT release). `tests/test_db_isolation.py`
proves a committed row in one test is invisible to the next. Build a service directly with
this fixture for new business-logic tests.

**API integration tests: not applicable.** `TestClient` runs the ASGI app in its own event
loop (a portal thread), so it cannot share the fixture's async connection. These keep the
deterministic reseed: `make test` / `scripts/test-api.sh` run `seed --reset` first and stop
`beat`/`worker`. New API tests must still follow the IS-1 rule (relative deltas / unique
markers, no absolute-count or page-1 assertions on non-seed data).

## Ratchets (CI)

| Job | Script | Guards |
|---|---|---|
| `backend-types` | `scripts/mypy-ratchet.sh` | `mypy app` error count vs `.mypy-baseline` (TYP-1) |
| `backend-layering` | `scripts/repo-layering-ratchet.sh` | service-layer `select()` line count vs `.repo-layering-baseline` (C-3) |

Both fail only on **growth**. When you fix errors or move a query into a repository, lower
the baseline with `--update`.

## Multi-role session tests

`tests/test_auth_session.py` verifies the FR-01 requirement that several role sessions
coexist in one cookie jar and logout is isolated — see `docs/backend/AUTHENTICATION.md`.

## State machines

`tests/test_state_machines.py` + each module's `test_*_unit.py` — see
`docs/backend/STATE_MACHINES.md`.

## Cross-tenant isolation

`tests/test_cross_tenant_idor.py` (API-level sweep) + `tests/test_tenant_isolation.py`
(DB RLS) + per-module `test_*_api.py` cross-community cases.

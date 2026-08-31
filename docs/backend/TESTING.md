# Backend Testing

## Test types

| Layer | Files | Needs |
|---|---|---|
| Unit / service | `app/modules/*/tests/test_*_unit.py` | in-process DB session; fast |
| API integration | `app/modules/*/tests/test_*_api.py`, `tests/test_*.py` | the real Postgres + Redis + MinIO from `docker compose`, **seeded** |
| RLS | `tests/test_tenant_isolation.py` | a `NOBYPASSRLS` DB role (created by the fixture) |

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

**Not yet done** (tracked): transactional per-test rollback fixtures for the API tests
(large refactor — ~250 tests). Until then, `make test` (with reseed) is the reliable
entrypoint; `make test-fast` is best-effort.

## Multi-role session tests

`tests/test_auth_session.py` verifies the FR-01 requirement that several role sessions
coexist in one cookie jar and logout is isolated — see `docs/backend/AUTHENTICATION.md`.

## State machines

`tests/test_state_machines.py` + each module's `test_*_unit.py` — see
`docs/backend/STATE_MACHINES.md`.

## Cross-tenant isolation

`tests/test_cross_tenant_idor.py` (API-level sweep) + `tests/test_tenant_isolation.py`
(DB RLS) + per-module `test_*_api.py` cross-community cases.

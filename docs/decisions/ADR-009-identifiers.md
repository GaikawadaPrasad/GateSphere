# ADR-009: UUID primary keys (deviation from ERD v1.2 BIGINT)

- **Status:** Accepted
- **Date:** 2026-08-27
- **Supersedes for identity:** the BIGINT identity columns shown in DB ERD v1.2

## Context

DB ERD v1.2 models every table with `id BIGINT GENERATED ALWAYS AS IDENTITY`. GateSphere is a
security product: sequential integer ids are enumerable, which makes IDOR/BOLA bugs (and simple
scraping of "how many residents does this community have") easier to exploit if any endpoint ever
misses a scope check.

## Decision

Use **UUID v4 primary keys repo-wide**, generated in the application layer
(`app/db/base_class.py::pk`). All FKs are `Uuid`. `community_id` is `Uuid`.

## Alternatives considered

- **BIGINT identity (as per ERD)** — smaller, faster joins/indexes, natural ordering. Rejected
  for the enumerability reason above; the ordering benefit is not needed (we sort on `created_at`).
- **UUID v7 (time-ordered)** — better index locality than v4. Deferred: not yet first-class in the
  stack; revisit if UUID index bloat is ever measured as a real problem.

## Trade-offs

- Slightly larger indexes and a small write-side cost vs BIGINT. Acceptable at this scale.
- The ERD's column type is now advisory for identity only; every other detail in
  `docs/database/schema.md` (relationships, constraints, append-only rules) still holds.

## Consequences

- 404-not-403 for cross-tenant access and RLS (ADR + migration 0003) remain the primary
  isolation controls; non-enumerable ids are defence in depth, not the mechanism.
- `docs/database/schema.md` and `AGENTS.md §8.1` record this deviation.

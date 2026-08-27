# GateSphere Documentation

Documentation is part of the architecture. It is **layered** — read at the level you need.

```
Platform docs   -> "What does the whole system do?"      docs/platform/
Module docs     -> "How does each app implement it?"      docs/backend/modules/, docs/frontend/modules/
Flow docs       -> "How does a business process run end-to-end?"  docs/flows/
API docs        -> "What is the exact contract?"          docs/backend/api/  (+ OpenAPI at /docs)
Database docs   -> "Why does this table/relationship exist?"  docs/database/
Security docs   -> "How is it kept safe?"                 docs/security/
Decisions       -> "Why was it built this way?"           docs/decisions/  (ADRs)
```

## Index

| Area | Location |
|------|----------|
| **Engineering contract** | [`../AGENTS.md`](../AGENTS.md) — read before writing code |
| System architecture & app map | [`platform/system-architecture.md`](platform/system-architecture.md), [`platform/application-map.md`](platform/application-map.md) |
| Local development | [`../STARTER.md`](../STARTER.md), [`platform/local-development.md`](platform/local-development.md) |
| Staging deployment | [`platform/deployment-staging.md`](platform/deployment-staging.md) |
| Authentication & RBAC | [`platform/authentication.md`](platform/authentication.md), [`security/roles-permissions.md`](security/roles-permissions.md) |
| **API contract** (envelope, status map) | [`platform/api-contract.md`](platform/api-contract.md) |
| **Canonical DB schema** (ERD v1.2) | [`database/schema.md`](database/schema.md) |
| Backend modules | [`backend/modules/`](backend/modules/) |
| Frontend modules | [`frontend/modules/`](frontend/modules/) |
| Business flows | [`flows/`](flows/) |
| Per-endpoint API docs | [`backend/api/`](backend/api/) |
| Database | [`database/`](database/) |
| Security | [`security/`](security/) |
| Decisions (ADR) | [`decisions/`](decisions/) |
| **Session notes** (working continuity log) | [`development/session-notes.md`](development/session-notes.md) |

## Rules

1. Behaviour-changing code updates the relevant doc **in the same PR**.
2. One canonical source per fact — cross-platform rules live in `platform/`, never copied per app.
3. No doc describes behaviour that does not exist.
4. Every module has an owner (Backend / Web / Docs) recorded in its README.

## Module catalogue

`auth` · `users` · `communities` · `residents` · `visitors` · `gate` · `domestic_staff` ·
`deliveries` · `vehicles` · `billing` · `complaints` · `amenities` · `communication` ·
`incidents` · `notifications` · `audit` · `dashboards`

# Backend Architecture Diagrams

Code-derived Mermaid documentation of the GateSphere FastAPI backend.

```
docs/architecture/backend/
├── README.md                     ← this file
├── route-inventory.md            ← every route: method · path · auth · permission · service · mutation · side effects
├── backend-architecture.mmd      ← one end-to-end system diagram (client → response) for all 20 modules
└── modules/
    ├── auth.mmd                   ← one diagram per backend module, full flow in isolation
    ├── users.mmd
    ├── rbac.mmd
    ├── audit.mmd
    ├── communities.mmd
    ├── onboarding.mmd
    ├── residents.mmd
    ├── visitors.mmd
    ├── gate.mmd
    ├── domestic_staff.mmd
    ├── deliveries.mmd
    ├── vehicles.mmd
    ├── billing.mmd
    ├── complaints.mmd
    ├── amenities.mmd
    ├── communication.mmd
    ├── incidents.mmd
    ├── dashboards.mmd
    ├── notifications.mmd
    └── uploads.mmd
```

## Purpose

- **`backend-architecture.mmd`** — the system in one picture: the request pipeline (middleware →
  auth → RBAC → tenant scope), the route groups, the service/repository/model layering, the
  cross-cutting concerns (PostgreSQL RLS, Redis session cache, Celery beat/worker, the
  notification event bus, S3/MinIO object storage), and how a mutation flows through to
  persistence + side effects.
- **`modules/<module>.mmd`** — the complete flow for that one module: every route, its
  permission gate, its business conditionals (state machines, ownership / own-unit checks,
  atomic conflict checks), the service methods it calls, the repositories and ORM models it
  reads/writes, any file it invokes, any background job it triggers, any notification event it
  emits, and any external integration it calls.

## Source-of-truth policy

```
SOURCE CODE  →  ACTUAL ROUTES / LOGIC  →  MODULE DIAGRAMS  →  COMBINED DIAGRAM
```

The diagrams describe the implementation — never the other way around. If the code and a
diagram disagree, **the code is investigated first and the diagram is corrected** to match the
verified implementation. Planned-but-unbuilt behaviour is not documented as if it exists.

Every diagram was derived by:
`app/main.py` + `app/api/router.py` (router registration) → `app/modules/<m>/router.py` (routes,
HTTP methods, permission deps) → `app/modules/<m>/deps.py` (dependency wiring) →
`app/modules/<m>/service.py` (branches, persistence, events, integrations) →
`app/modules/<m>/repository.py` + `models.py` (mutations) → `app/core/celery_app.py` +
`app/modules/<m>/tasks.py` (background jobs). The route inventory was cross-checked against the
live `GET /api/v1/openapi.json` (256 registered routes, ~230 API routes).

## How diagrams are maintained

Whenever a backend change touches any of: a route (path/method), authentication, authorization,
a permission code, input validation, a business condition, a state transition, a service or
repository, a database mutation, an ORM model, an orchestrator/task/queue, an event, an
external integration, a generated file, a notification, or an error path — the author MUST:

1. Update the affected `modules/<module>.mmd`.
2. Update `backend-architecture.mmd` if the module-to-module wiring changed.
3. Update `route-inventory.md`.
4. Re-verify both diagrams against the implementation and validate Mermaid syntax.

This rule is recorded in `AGENTS.md` (documentation section).

## Route → diagram mapping

| Route prefix | Module diagram | Router file |
|---|---|---|
| `/auth/*` | `modules/auth.mmd` | `app/modules/auth/router.py` |
| `/users/*` | `modules/users.mmd` | `app/modules/users/router.py` |
| `/rbac/*` | `modules/rbac.mmd` | `app/modules/rbac/router.py` |
| `/audit/*` | `modules/audit.mmd` | `app/modules/audit/router.py` |
| `/communities/*` (property + tenants) | `modules/communities.mmd` + `modules/onboarding.mmd` | `communities/router.py`, `onboarding/router.py` |
| `/invitations/*` (public token) | `modules/onboarding.mmd` | `app/modules/onboarding/router.py` |
| `/residents/*` | `modules/residents.mmd` | `app/modules/residents/router.py` |
| `/visitors/*` | `modules/visitors.mmd` | `app/modules/visitors/router.py` |
| `/gate/*` | `modules/gate.mmd` | `app/modules/gate/router.py` |
| `/domestic-staff/*` | `modules/domestic_staff.mmd` | `app/modules/domestic_staff/router.py` |
| `/deliveries/*` | `modules/deliveries.mmd` | `app/modules/deliveries/router.py` |
| `/vehicles/*` | `modules/vehicles.mmd` | `app/modules/vehicles/router.py` |
| `/billing/*` | `modules/billing.mmd` | `app/modules/billing/router.py` |
| `/complaints/*` | `modules/complaints.mmd` | `app/modules/complaints/router.py` |
| `/amenities/*` | `modules/amenities.mmd` | `app/modules/amenities/router.py` |
| `/communication/*` | `modules/communication.mmd` | `app/modules/communication/router.py` |
| `/incidents/*` | `modules/incidents.mmd` | `app/modules/incidents/router.py` |
| `/dashboards/*` | `modules/dashboards.mmd` | `app/modules/dashboards/router.py` |
| `/notifications/*` | `modules/notifications.mmd` | `app/modules/notifications/router.py` |
| `/uploads/*` | `modules/uploads.mmd` | `app/modules/uploads/router.py` |
| `/`, `/healthz`, `/readyz`, `/docs`, `/redoc` | `backend-architecture.mmd` (ops) | `app/main.py` |

## Module ownership

Each module is a `router + deps + service + repository + models + schemas + tasks + tests`
package under `app/modules/<name>/` (the `communities` module is the reference shape). The
module diagram is owned by whoever changes that package.

## Rendering

`.mmd` files are plain Mermaid `flowchart` definitions. Render with the Mermaid CLI
(`mmdc -i x.mmd -o x.svg`), the VS Code Mermaid extension, or any Markdown viewer that supports
` ```mermaid ` fences (wrap the file body in a fence).

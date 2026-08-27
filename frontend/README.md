# GateSphere Frontend (Next.js)

Web client for all 10 roles. Consumes the FastAPI contract; the backend is authoritative.

- **Type:** Next.js 15 App Router, React 19, TypeScript (strict)
- **Data:** TanStack Query (server state) + local component state (UI state)
- **Auth:** session cookies set by the backend; `/api/*` is proxied same-origin (see `next.config.mjs`)
- **Styling:** plain CSS for the scaffold (`app/globals.css`) — swap for your design system

## Layout

```
app/
  layout.tsx        root layout + providers
  providers.tsx     TanStack Query client
  page.tsx          landing
  login/page.tsx    session login
  dashboard/page.tsx role-aware dashboard shell
lib/api.ts          typed fetch client (adds X-CSRF-Token on unsafe methods, credentials: include)
middleware.ts       route guard (cookie presence -> redirect to /login)
```

## Run

Via the root stack (`make up`) — served at http://localhost:3000 with hot reload.

Bare metal (needs Node 20): `npm install`, copy `.env.example` → `.env.local`, `npm run dev`.

## Conventions

- Server Components by default; `"use client"` only when you need state/effects/events.
- One `useQuery`/`useMutation` per concern; mutations invalidate the affected query keys.
- No `any`. API types live in `lib/api.ts` (or a generated client later).
- Permission-based UI: hide/disable controls the user can't use — but never rely on it for security.
- `npm run lint` + `npm run typecheck` + `npm run format` before PR.

## Staging

Deployed to Vercel from `main`. `BACKEND_INTERNAL_URL` (or a Vercel rewrite) points at the
Render backend. See [`../docs/platform/deployment-staging.md`](../docs/platform/deployment-staging.md).

## Docs

Per-module UI docs: [`../docs/frontend/modules/`](../docs/frontend/modules/). Rules: [`AGENTS.md`](AGENTS.md).

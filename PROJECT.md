# PROJECT.md — Agent Orchestration Manifest

## Project
- **Name:** AR Copilot
- **Path:** /Users/colt/Code/ar-copilot
- **Repo:** ColtMercer/ar-copilot
- **Stack:** Next.js 15 + TypeScript + Auth0 + Stripe + PostgreSQL (via lib/db.ts)
- **Test command:** `npm run build` (no test suite yet — build success = green)
- **Dev command:** `npm run dev`
- **Port:** 3000

## File Domains

Agents must only touch files within their assigned domain. No cross-domain writes without flagging it first.

| Domain | Paths | Notes |
|--------|-------|-------|
| lib | `lib/` | Shared utilities: db, auth, billing, stripe clients. High blast radius — coordinate carefully |
| api | `app/api/` | All route handlers. Each route can be assigned independently (e.g., one agent per API feature area) |
| ui-pages | `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/thanks/` | Landing page, root layout, global styles |
| ui-dashboard | `app/dashboard/` | Dashboard page + client component |
| ui-admin | `app/admin/` | Admin page + client component |
| ui-components | `app/components/` | Shared components (e.g., PricingButton) |
| config | `middleware.ts`, `next.config.ts`, `package.json`, `tsconfig.json`, `Dockerfile` | Always single-agent, never parallel |

## Wave Order

```
Wave 1: lib (if schema/DB changes needed)
Wave 2: api (depends on lib changes)
Wave 3: ui-dashboard, ui-admin, ui-components (parallel, depend on api shape)
Wave 4: ui-pages, config (usually independent)
```

For features that don't touch `lib`, start directly at Wave 2.

## Commit Convention
`feat: <description>` | `fix: <description>` | `refactor: <description>`

## Singleton Files (one agent only, never concurrent)
- `lib/db.ts` — shared DB client
- `lib/auth.ts` — auth helpers
- `lib/billing.ts` — billing logic
- `middleware.ts` — auth middleware
- `next.config.ts` — Next.js config
- `package.json` — dependencies

## Current State (as of 2026-03-01)
- Auth0 login/logout working
- Stripe checkout + billing portal working
- Dashboard shows client data from DB
- API routes: clients, invoices, chase-list, followups, templates, waitlist
- Admin page exists

## Agent Notes
- No test suite yet — agents should verify with `npm run build` (catches TypeScript errors)
- Auth0 env vars: see `.env` — do not hardcode values
- DB client is in `lib/db.ts` — all DB access must go through it
- Stripe client is in `lib/stripe.ts`

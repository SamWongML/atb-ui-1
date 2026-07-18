# Integrating this frontend into the auto-tobe monorepo

This repository is the **extracted, self-contained auto-tobe frontend**: the
Next.js web app plus its shared packages, under the `@atb/*` scope. It installs,
typechecks, lints, builds, and tests green on its own (`make check`). This guide
explains how to drop it into the destination **auto-tobe monorepo** (pnpm
workspaces + Turborepo) alongside the existing `api`, `daemon`, and `gateway`.

## What travels

| Path | Package | Purpose |
|---|---|---|
| `apps/web/` | `@atb/web` | Next.js 16 web app (App Router) |
| `packages/core/` | `@atb/core` | Headless logic — API client, stores, React Query hooks, WS |
| `packages/ui/` | `@atb/ui` | Atomic UI components (shadcn / Base UI) |
| `packages/views/` | `@atb/views` | Shared business pages/components |
| `packages/tsconfig/` | `@atb/tsconfig` | Shared TS config |
| `packages/eslint-config/` | `@atb/eslint-config` | Shared ESLint config |
| `e2e/` | — | Playwright specs (web-only) |

Dependency direction: `web → views → core + ui`; `core` and `ui` are independent;
nothing imports `next/*` or `react-router-dom` outside `apps/web`.

## Expected destination layout

The destination is assumed to be pnpm-workspaces + Turborepo with an
`apps/* + packages/*` layout. After integration:

```
auto-tobe/
  apps/
    web/          <- from here (@atb/web)
    ...           <- destination's own apps, if any
  packages/
    core/ ui/ views/ tsconfig/ eslint-config/   <- from here (@atb/*)
    ...           <- destination's own packages
  api/  gateway/  daemon/                         <- destination backend (already there)
  pnpm-workspace.yaml  turbo.json  package.json   <- destination's (merge, don't overwrite)
```

## Step by step

1. **Copy the packages + app.** Copy `apps/web` and `packages/{core,ui,views,tsconfig,eslint-config}`
   into the destination's `apps/` and `packages/`. Copy `e2e/` if the destination
   doesn't already have a web E2E suite (else merge the specs).

2. **Wire the workspace globs.** Ensure the destination `pnpm-workspace.yaml`
   globs cover `apps/*` and `packages/*` (they usually do). Do **not** overwrite
   the destination's file.

3. **Merge the pnpm `catalog:`.** This workspace pins all shared deps through the
   `catalog:` in `pnpm-workspace.yaml`. Merge those entries into the destination's
   catalog (or add a named catalog). The full list lives in
   [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — React 19, Next 16, TanStack
   Query/Table, Zustand, Zod 4, Tailwind 4, i18next, posthog-js, react-virtuoso,
   mermaid, katex, and the Vitest/Testing-Library stack. Every `@atb/*` package
   references these as `catalog:`; resolve any version conflicts with the
   destination's existing pins before installing.

4. **Merge `turbo.json` tasks.** This workspace defines `build`, `dev`,
   `typecheck`, `lint`, `test`. Merge them into the destination pipeline; keep the
   `globalEnv` entries for the `NEXT_PUBLIC_ATB_*` vars so build caching keys on them.

5. **Set env.** See [`.env.example`](.env.example). The two required vars:
   - `NEXT_PUBLIC_ATB_API_URL` — the `api` origin (HTTP; serves `/api/*` and `/auth/*`).
   - `NEXT_PUBLIC_ATB_GATEWAY_WS_URL` — the `gateway` origin (WebSocket, `…/ws`).

   Optional: `NEXT_PUBLIC_APP_VERSION`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_PORT`,
   `FRONTEND_ORIGIN`. **Runtime config that used to be build-time** (PostHog key,
   Google OAuth client id, signup gating) is delivered by the api's
   `GET /api/config` — not env — so nothing else needs threading through.

6. **CORS.** The web app now calls the `api` and `gateway` as **absolute
   cross-origin URLs** (no same-origin Next proxy). The `api` must send
   `Access-Control-Allow-Origin: <web origin>` **with** `Access-Control-Allow-Credentials: true`
   (cookie-auth mode sends `credentials: include`). The `gateway` must accept the
   web origin on the WS upgrade.

7. **Install + verify.** From the destination root: `pnpm install`, then
   `pnpm exec turbo build typecheck lint test --filter=@atb/web...`.

## Auth & transport surface (unchanged by the extraction)

- HTTP requests carry `X-Workspace-Slug`, `X-CSRF-Token` (cookie mode),
  `X-Client-Platform/Version/OS`, `X-Request-ID`; `credentials: include`.
- WS handshake sends `workspace_slug` + `client_*` as query params; token mode
  sends `{type:"auth", payload:{token}}` as the first message, cookie mode relies
  on the HttpOnly cookie on the upgrade.
- Full detail: [`docs/contract-expectations.md`](docs/contract-expectations.md).

## Contract expectations & the reconciliation follow-on

The data layer still speaks the **old** api contract — it compiles, but it is
**not yet reconciled** to the diverged auto-tobe api. Do not reconcile it here;
that is a deliberate in-place follow-on run against the live api.

[`docs/contract-expectations.md`](docs/contract-expectations.md) is its diff
target: every REST endpoint, response schema/fallback, WS event, and the auth
handshake the frontend expects today.

## Deferred / out of scope

These are **not** done here and return only as fresh efforts:

- **Per-domain data-layer reconciliation** to the diverged auto-tobe api (the
  follow-on; the contract catalog is its input).
- **Gateway WS protocol reconciliation** — event shapes / auth handshake beyond
  the URL/origin repoint done in ticket #5. The `daemon:register` / `daemon:heartbeat`
  event names are backend-contract strings kept as-is behind a seam.
- **Upload URL resolution** — attachment URLs are same-origin `/uploads/*` today;
  resolving them against the api origin / CDN is part of reconciliation.
- **E2E login harness** — `e2e/fixtures.ts` (`TestApiClient`) still reads the
  one-time verification code straight from the DB via a raw `pg` client
  (`DATABASE_URL`, table `verification_code`) — a leftover coupling to the
  removed `server/` migrations' schema. Running the E2E suite needs
  `DATABASE_URL` pointed at the api's database; migrating the login harness to
  an api-based flow is part of reconciliation.
- **Cloud runtime re-model** — the local-runtime UI was stripped; the abstract
  `agent.runtime` binding + runtime queries/types are kept behind documented
  seam markers (`packages/core/runtimes/`) and re-model onto cloud runners later.
  Onboarding's connect-runtime + agent steps were dropped and return then.
- **Desktop app** — removed; a future cloud desktop client is a separate effort.
  (`packages/views` deliberately stays free of `next/*` so a second app can
  consume it.)
- **Docs site** migration.

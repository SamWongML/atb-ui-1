# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **This is the extracted `auto-tobe` frontend workspace.** The Go backend,
> local daemon, CLI, and Electron desktop app were removed when this tree was
> pulled out to drop into the auto-tobe monorepo. The app talks to a separate
> **api** (HTTP) and **gateway** (WebSocket) — see [`INTEGRATION.md`](INTEGRATION.md)
> for how it slots in, and [`docs/contract-expectations.md`](docs/contract-expectations.md)
> for exactly what it expects from that backend.

## Conventions reference

The single source of truth for **code naming, the i18n translation glossary, and the Chinese voice guide** is [`docs/conventions.md`](docs/conventions.md).

Read that page before:

- Writing or editing translations (`packages/views/locales/`)
- Naming a new route, package, file, or TS type
- Writing Chinese product copy (UI strings, error messages)

The legacy `packages/views/locales/glossary.md` is a stub redirecting to it; do not rely on it.

## Project Context

auto-tobe is an AI-native task management platform — like Linear, but with AI agents as first-class citizens.

- Agents can be assigned issues, create issues, comment, and change status
- Agents run on cloud runtimes (the runtime binding is kept behind a documented seam; local-runtime surfaces were stripped in the extraction)
- Built for 2-10 person AI-native teams

## Architecture

**Frontend monorepo (pnpm workspaces + Turborepo) with shared packages.** The backend (`api` + `gateway`) lives in the destination monorepo, not here.

- `apps/web/` — Next.js frontend (App Router)
- `packages/core/` — Headless business logic (zero react-dom, all-platform reuse)
- `packages/ui/` — Atomic UI components (zero business logic)
- `packages/views/` — Shared business pages/components (zero next/* imports, zero react-router imports)
- `packages/tsconfig/` — Shared TypeScript configuration
- `packages/eslint-config/` — Shared ESLint configuration
- `e2e/` — Playwright end-to-end specs (web-only)

### Key Architectural Decisions

**Internal Packages pattern** — all shared packages export raw `.ts`/`.tsx` files (no pre-compilation). The consuming app's bundler compiles them directly. This gives zero-config HMR and instant go-to-definition.

**Dependency direction:** `views/ → core/ + ui/`. Core and UI are independent of each other. No package imports from `next/*`, `react-router-dom`, or app-specific code — the packages stay platform-agnostic so the destination monorepo can consume them from more than one app.

**Platform bridge:** `packages/core/platform/` provides `CoreProvider` — initializes the API client, auth/workspace stores, WS connection, and QueryClient. `apps/web` wraps its root with `<CoreProvider>` and provides its own `NavigationAdapter`. The api base URL and gateway WS URL are env-driven (`NEXT_PUBLIC_ATB_API_URL`, `NEXT_PUBLIC_ATB_GATEWAY_WS_URL`); there are no hardcoded backend defaults.

**pnpm catalog** — `pnpm-workspace.yaml` defines `catalog:` for version pinning. All shared deps use `catalog:` references to guarantee a single version across all packages. When adding new shared deps (including test deps), add to catalog first.

### State Management

The architecture relies on a strict split between server state and client state. Mixing them is the most common way to break it.

- **TanStack Query owns all server state.** Issues, users, workspaces, inbox — anything fetched from the API lives in the Query cache. WS events keep it fresh via invalidation; no polling, no `staleTime` workarounds.
- **Zustand owns all client state.** UI selections, filters, drafts, modal state, navigation history. Stores live in `packages/core/` (never in `packages/views/`) so any consuming app shares them.
- **React Context** is reserved for cross-cutting platform plumbing — `WorkspaceIdProvider`, `NavigationProvider`. Don't reach for it for general state.
- **Auth and workspace stores are the only stores allowed to call `api.*` directly**, because they manage critical state that must exist before queries can run. They're created via factory + injected dependencies, registered by the platform layer.

**Hard rules — these are how the architecture stays coherent:**

- **Never duplicate server data into Zustand.** If it came from the API, it belongs in the Query cache. Copying it into a store creates two sources of truth and they will drift.
- **Workspace-scoped queries must key on `wsId`.** This is what makes workspace switching automatic — the cache key changes, the right data appears, no manual invalidation needed.
- **Mutations are optimistic by default.** Apply the change locally, send the request, roll back on failure, invalidate on settle. The user shouldn't wait for the server.
- **WS events invalidate queries — they never write to stores directly.** This keeps the cache as the single source of truth and avoids race conditions.
- **Persist what's worth preserving across restarts** (user preferences, drafts, tab layout). **Don't persist ephemeral UI state** (modal open/close, transient selections) or server data.

**Common Zustand footguns to avoid:**

- Selectors must return stable references. Returning a freshly built object or array on every call (e.g. `s => ({ a: s.a, b: s.b })` or `s => s.items.map(...)`) triggers infinite re-renders. Either select primitives separately or use shallow comparison.
- Hooks that need workspace context should accept `wsId` as a parameter, not call `useWorkspaceId()` internally — this lets them work outside the `WorkspaceIdProvider` (e.g. in a sidebar that renders before workspace is loaded).

## Commands

```bash
pnpm install
pnpm dev:web          # Next.js dev server (port 3000)
pnpm build            # Build apps/web + packages
pnpm typecheck        # TypeScript check (all packages + apps via turbo)
pnpm lint             # ESLint
pnpm test             # TS tests (Vitest, all packages + apps via turbo)

# Or via the Makefile wrappers
make dev              # pnpm dev:web
make check            # typecheck + lint + test + build

# Run a single TS test (works for any package with a test script)
pnpm --filter @atb/views exec vitest run auth/login-page.test.tsx
pnpm --filter @atb/core exec vitest run runtimes/version.test.ts
pnpm --filter @atb/web exec vitest run app/\(auth\)/login/page.test.tsx

# Run a single E2E test (requires the app + a reachable api)
pnpm exec playwright test e2e/issues.spec.ts

# shadcn — config lives in packages/ui/components.json (Base UI variant, base-nova style)
pnpm ui:add badge     # Adds component to packages/ui/components/ui/
```

### CI Requirements

CI runs on Node 22. See `.github/workflows/ci.yml` — it installs deps and runs `turbo build typecheck lint test`.

## Coding Rules

- TypeScript strict mode is enabled; keep types explicit.
- Keep comments in code **English only**.
- Prefer existing patterns/components over introducing parallel abstractions.
- Unless the user explicitly asks for backwards compatibility, do **not** add compatibility layers, fallback paths, dual-write logic, legacy adapters, or temporary shims **for internal, non-boundary code** (a function calling another function in the same package, a component reading its own state, a store helper, etc.).
- This rule does **not** apply at the API boundary: this frontend is versioned and deployed separately from the auto-tobe `api`, so any response shape **will** drift out from under a build already shipped. API response handling must follow the rules in **API Response Compatibility** below — that is a defensive boundary, not a legacy shim.
- If a flow or API is being replaced and the product is not yet live, prefer removing the old path instead of preserving both old and new behavior.
- Avoid broad refactors unless required by the task.
- New global (pre-workspace) routes MUST use a single word (`/login`, `/inbox`) or a `/{noun}/{verb}` pair (`/workspaces/new`). NEVER add hyphenated word-group root routes (`/new-workspace`, `/create-team`) — they collide with common user workspace names and force endless reserved-slug audits. Reserving the noun (`workspaces`) automatically protects the entire `/workspaces/*` subtree.
- The reserved-slug list lives in `packages/core/paths/reserved-slugs.ts` — a hand-maintained static list. (It was previously generated from the Go backend's `reserved_slugs.json`; that source and its generator were removed in the extraction. The destination `api` owns the server-side reserved-slug list — keep the two in sync during reconciliation.)

### API Response Compatibility

This frontend ships and updates on a different cadence than the auto-tobe `api`: a build in a user's browser (or an install that drops into the destination monorepo) will hit an api that has moved on. Every response shape is a contract that **will** drift, and the frontend must survive drift without white-screening.

When writing code that consumes an API response, follow these rules:

- **Parse, don't cast.** Untyped JSON crossing the network is not `T`. Use `parseWithFallback` in `packages/core/api/schema.ts` with a `zod` schema and an explicit fallback. On validation failure it logs a warning and returns the fallback; it never throws into the UI.
- **No bare `as` casts on response bodies.** Every endpoint method whose response is consumed by UI logic must run through a schema before returning.
- **Optional-chain and default everywhere downstream.** Treat every field as possibly missing. Use explicit boolean checks (`=== true`) over truthy/falsy negation, which silently treats `undefined` and `null` as `false`.
- **Don't pin a UI affordance to a single backend field.** If a button or indicator depends on exactly one boolean from the server, a backend bug deletes it. Combine signals (cursor presence, page length, etc.) so the affordance stays available in the worst case.
- **Enum drift downgrades, not crashes.** A new server-side enum value should render a generic fallback. `switch` statements on server-driven strings must have a `default` branch.
- **When you add or change an endpoint:** add the schema in the same PR, and write at least one test that feeds a malformed response through it (missing field, wrong type, `null` array). The test fails closed if a future change breaks the contract.

This is not premature defense. The current data layer still speaks the **old** contract (it compiles; it is not yet reconciled to the diverged api — that is a deliberate follow-on); `docs/contract-expectations.md` is the diff target.

### Package Boundary Rules

These are hard constraints. Violating them breaks the reusable-package architecture:

- `packages/core/` — zero react-dom, zero localStorage (use StorageAdapter), zero process.env, zero UI libraries. **All shared Zustand stores live here**, even view-related ones (filters, view modes) — stores are pure state, not UI.
- `packages/ui/` — zero `@atb/core` imports (pure UI, no business logic).
- `packages/views/` — zero `next/*` imports, zero `react-router-dom` imports, zero stores. Use `NavigationAdapter` for all routing.
- `apps/web/platform/` — the only place for Next.js APIs (`next/navigation`).

### The No-Duplication Rule

**Shared logic belongs in a shared package, not in the app.** Components, hooks, guards, providers, utility functions:

1. Does this code depend on Next.js APIs? → Keep in `apps/web/platform/`.
2. Everything else → belongs in `packages/core/` (headless logic) or `packages/views/` (UI components).

Keep `packages/views` free of `next/*` so it stays consumable by any app the destination monorepo adds later. Inject platform differences through props/slots (`extra`, `topSlot`) rather than branching inside shared components.

### CSS Architecture

The app and shared packages use one CSS foundation from `packages/ui/styles/`.

- **Design tokens** → use semantic tokens (`bg-background`, `text-muted-foreground`). Never use hardcoded Tailwind colors (`text-red-500`, `bg-gray-100`).
- **Shared styles** → `packages/ui/styles/`. Never duplicate scrollbar styling, keyframes, or base layer rules in app CSS.
- **`@source` directives** → the app scans shared packages so Tailwind sees all class names.

## UI/UX Rules

- Prefer shadcn components over custom implementations. Install via `pnpm ui:add <component>` from project root — adds to `packages/ui/components/ui/`. All components use Base UI primitives (`@base-ui/react`), not Radix.
- Use shadcn design tokens for styling. Avoid hardcoded color values.
- Do not introduce extra state (useState, context, reducers) unless explicitly required by the design.
- Pay close attention to **overflow** (truncate long text, scrollable containers), **alignment**, and **spacing** consistency.
- **Reusable UI belongs in a shared package**, not copy-pasted into the app.

## Testing Rules

### Where to write tests

Tests follow the code, not the app:

| What you're testing | Where the test lives | Why |
|---|---|---|
| Shared business logic (stores, queries, hooks) | `packages/core/*.test.ts` | No DOM needed, pure logic |
| Shared UI components (pages, forms, modals) | `packages/views/*.test.tsx` | jsdom, no framework mocks |
| Platform-specific wiring (cookies, redirects, searchParams) | `apps/web/*.test.tsx` | Needs framework-specific mocks |
| End-to-end user flows | `e2e/*.spec.ts` | Real browser, real api |

**Never test shared component behavior in an app's test file.** If a test requires mocking `next/navigation` to test a component from `@atb/views`, the test is in the wrong place — move it to `packages/views/` and mock `@atb/core` instead.

### Test infrastructure

- `packages/core/` — Vitest, Node environment (no DOM)
- `packages/views/` — Vitest, jsdom environment, `@testing-library/react`
- `apps/web/` — Vitest, jsdom environment, framework-specific mocks
- `e2e/` — Playwright

All test deps are in the pnpm catalog for unified versioning.

### Mocking conventions

- Mock `@atb/core` stores with `vi.hoisted()` + `Object.assign(selectorFn, { getState })` pattern (Zustand stores are both callable and have `.getState()`).
- Mock `@atb/core/api` for API calls.
- In `packages/views/` tests: never mock `next/*` or `react-router-dom` — those don't exist here.
- In `apps/web/` tests: mock framework-specific APIs only for platform-specific behavior.

### TDD workflow

1. Write failing test in the **correct package** first.
2. Write implementation.
3. Run `pnpm test` (Turborepo discovers all packages).
4. Green → done.

### E2E tests

E2E tests should be self-contained. They require the app plus a reachable api (see `e2e/fixtures.ts` `TestApiClient`). The Playwright config points at the env-driven URLs.

## Commit Rules

- Use atomic commits grouped by logical intent.
- Conventional format: `feat(scope)`, `fix(scope)`, `refactor(scope)`, `docs`, `test(scope)`, `chore(scope)`.

## Minimum Pre-Push Checks

```bash
make check    # typecheck + lint + test + build
```

Run verification only when the user explicitly asks for it. For targeted checks:

```bash
pnpm typecheck        # TypeScript type errors only
pnpm lint             # ESLint only
pnpm test             # TS unit tests only (Vitest, all packages)
pnpm exec playwright test   # E2E only (requires the app + a reachable api)
```

## AI Agent Verification Loop

After writing or modifying code, run the verification pipeline:

```bash
make check
```

**Workflow:** write code → `make check` → read errors, fix, re-run → repeat until green → only then consider the task complete. For faster feedback, run the affected individual check first (`pnpm typecheck` or a single test file), then finish with a full `make check`.

## Multi-tenancy

All workspace-scoped requests carry the active workspace via the `X-Workspace-Slug` header (HTTP) / `workspace_slug` query param (WS); the api gates access by membership. Workspace-scoped queries key on `wsId` so switching workspaces swaps the cache automatically.

## Agent Assignees

Assignees are polymorphic — can be a member or an agent. `assignee_type` + `assignee_id` on issues. Agents render with distinct styling (purple background, robot icon).

## Agent skills

### Issue tracker

Issues are tracked in this repo's **GitHub Issues** via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

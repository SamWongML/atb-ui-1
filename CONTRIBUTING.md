# Contributing Guide

This is the extracted **auto-tobe frontend** workspace — the Next.js web app plus
its shared packages. There is no backend here; the app talks to a separate `api`
and `gateway` (see [INTEGRATION.md](INTEGRATION.md)).

Read [CLAUDE.md](CLAUDE.md) first — it holds the authoritative architecture,
package boundaries, state-management rules, and coding conventions.

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) v10.28+

## Setup

```bash
pnpm install
cp .env.example .env.local
# set NEXT_PUBLIC_ATB_API_URL + NEXT_PUBLIC_ATB_GATEWAY_WS_URL to a reachable
# auto-tobe api + gateway
pnpm dev:web          # http://localhost:3000
```

## Development workflow

1. Branch off `main`.
2. Make your change. Keep it inside the right package boundary (see CLAUDE.md):
   - Shared business logic → `packages/core/`
   - Shared UI → `packages/ui/` (atomic) or `packages/views/` (business)
   - Next.js-specific wiring → `apps/web/platform/`
3. Write tests in the package that owns the code (tests follow the code, not the app).
4. Run the checks and open a PR.

```bash
pnpm typecheck        # TypeScript
pnpm lint             # ESLint
pnpm test             # Vitest unit tests (all packages)
pnpm build            # Next.js + package builds
make check            # all of the above, in order
```

For faster iteration, run a single test file:

```bash
pnpm --filter @atb/views exec vitest run auth/login-page.test.tsx
pnpm --filter @atb/core exec vitest run runtimes/version.test.ts
```

## Important rules

- **TypeScript strict mode** is on; keep types explicit. Comments in code are English only.
- **Parse, don't cast** API responses — see *API Response Compatibility* in CLAUDE.md. The data layer still speaks the old contract; `docs/contract-expectations.md` is the reconciliation diff target.
- **Respect package boundaries.** `packages/core` has no react-dom / localStorage / process.env; `packages/views` has no `next/*`. Shared logic that would otherwise be duplicated must move into a shared package.
- **Design tokens only** for styling (`bg-background`, not `bg-gray-100`). Prefer shadcn components (`pnpm ui:add <component>`).
- **i18n / Chinese copy** — follow `docs/conventions.md` (naming, translation glossary, Chinese voice guide).
- **Atomic commits**, conventional format: `feat(scope)`, `fix(scope)`, `refactor(scope)`, `docs`, `test(scope)`, `chore(scope)`.

## E2E tests

Playwright specs live in `e2e/` and require the app plus a reachable api. They're
self-contained via the `TestApiClient` fixture (`e2e/fixtures.ts`):

```bash
pnpm exec playwright test e2e/issues.spec.ts
```

## Issues

Issues are tracked in this repo's **GitHub Issues** via the `gh` CLI — see
`docs/agents/issue-tracker.md`.

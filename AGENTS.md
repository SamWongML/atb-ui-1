# Repository Guidelines

This file provides guidance to AI agents when working with code in this repository.

> **Single source of truth:** This file is a concise pointer document.
> All authoritative architecture, coding rules, commands, and conventions
> live in **CLAUDE.md** at the project root. Read that file first.

> This is the extracted `auto-tobe` **frontend** workspace — no backend lives
> here. It talks to a separate `api` + `gateway`. See `INTEGRATION.md`.

## Quick Reference

### Architecture

Frontend monorepo (pnpm workspaces + Turborepo) with shared packages.

- `apps/web/` — Next.js frontend (App Router)
- `packages/core/` — Headless business logic (Zustand stores, React Query hooks, API client)
- `packages/ui/` — Atomic UI components (shadcn/Base UI, zero business logic)
- `packages/views/` — Shared business pages/components
- `packages/tsconfig/` — Shared TypeScript config
- `packages/eslint-config/` — Shared ESLint config

### State Management (critical)

- **React Query** owns all server state (issues, members, agents, inbox, workspace list)
- **Zustand** owns all client state (current workspace selection, view filters, drafts, modals)
- All Zustand stores live in `packages/core/` — never in `packages/views/` or app directories
- WS events invalidate React Query — never write directly to stores

### Package Boundaries (hard rules)

- `packages/core/` — zero react-dom, zero localStorage, zero process.env
- `packages/ui/` — zero `@atb/core` imports
- `packages/views/` — zero `next/*`, zero `react-router-dom`, use `NavigationAdapter` for routing
- `apps/web/platform/` — only place for Next.js APIs

### Commands

```bash
make dev              # pnpm dev:web (Next.js dev server, port 3000)
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm test             # TS unit tests (Vitest)
make check            # typecheck + lint + test + build
```

See CLAUDE.md for the complete command reference.

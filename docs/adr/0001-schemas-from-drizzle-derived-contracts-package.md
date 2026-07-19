---
status: accepted
---

# Frontend response schemas come from a Drizzle-derived contracts package

The destination auto-tobe api owns its data model with Drizzle. Rather than the
frontend hand-writing zod schemas for every endpoint (duplicated shape
knowledge) or importing Drizzle table definitions directly (binds views to DB
shape, drags ORM code toward the client bundle), the destination monorepo gains
a **contracts package**: entity schemas derived from the api's Drizzle
definitions via `drizzle-zod`, with endpoint DTO/envelope schemas composed on
top and wire naming normalized there once. Each frontend contract module
imports its schemas from that package during per-domain reconciliation.

## Considered options

1. **Hand-written zod per contract module** — maximum decoupling, permanent
   hand-synced duplication of shape knowledge. Rejected: forfeits the
   single-source-of-truth win the monorepo makes possible.
2. **Frontend imports Drizzle table definitions directly** — no DTO layer, but
   couples UI to DB shape (a table refactor breaks views even when the wire
   format could have stayed stable) and still needs hand-written envelope/join
   schemas. Rejected.
3. **Shared contracts package (chosen)** — one implementation of every wire
   shape, owned by the api; the frontend consumes derived zod schemas/types
   only, never Drizzle itself.

## Consequences

- The contract-module fold in this repo stays **structure-only**: unguarded ops
  keep visible `as` casts inside their contract module, so
  `grep "as " */contract.ts` is the live per-domain reconciliation TODO list.
- `parseWithFallback` (lenient parse, fallback on drift) **remains at runtime
  even after schemas are shared.** Shared schemas make compile-time types match
  the current api, but a shipped frontend build still faces an api that moved
  on (CLAUDE.md "API Response Compatibility") — the runtime guard is about
  deploy skew, not authorship.
- Field-naming normalization (e.g. snake_case → whatever the contracts package
  declares) happens once, in the contracts package; each domain's rename lands
  mechanically via tsc errors when its schemas are swapped in.

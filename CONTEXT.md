# auto-tobe frontend

The extracted auto-tobe frontend workspace: the web app and shared packages
that speak to the auto-tobe backend (`api` over HTTP, `gateway` over WebSocket).
This glossary canonizes the language for how the frontend models that exchange.

## Language

**Domain**:
A resource family the frontend exchanges with the api — Issues, Inbox, Chat,
Agents, Runtimes, Workspace, and peers. The unit by which contracts, queries,
and reconciliation are organized.
_Avoid_: feature, module (unqualified), resource group

**Contract module**:
The single module that owns one domain's side of the wire contract: its
operations, request/response types, response schemas, and fallbacks. One per
domain; the only kind of module allowed to use the transport.
_Avoid_: api client, service, endpoints file

**Transport**:
The single module that carries every HTTP request — auth, workspace scoping,
correlation, error translation. The only place in the frontend that talks to
the network; contract modules receive it, never create it.
_Avoid_: fetch wrapper, http client, request helper

**Contracts package**:
The destination-monorepo package where the api publishes its wire shapes,
derived from its Drizzle definitions. The single source of truth that contract
modules import their schemas from once reconciled.
_Avoid_: shared types, DTO package, models package

**Fallback**:
The safe value a contract module returns when a response fails validation, so
drift degrades the surface instead of throwing into the UI.
_Avoid_: default, empty state (when meaning this mechanism)

**Reconciliation**:
The deferred, per-domain effort of aligning a contract module with the diverged
auto-tobe api — replacing inherited shapes with contracts-package imports and
verifying against the live backend.
_Avoid_: migration, backend sync

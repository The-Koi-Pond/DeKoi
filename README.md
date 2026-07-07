# DeKoi

DeKoi is a fresh, local-first story and character engine for private character conversations, scenes, and small story worlds.

This repository starts the no-dash DeKoi identity from a blank implementation under Apache-2.0. What may and may not be carried over from the older De-Koi line is defined once in [PROVENANCE.md](./PROVENANCE.md).

## Status

DeKoi is an early seed. The current app proves the first native product surfaces, storage contracts, and optional desktop host path; it is not feature-complete yet.

Current highlights:

- React and TypeScript app shell for the first DeKoi product loop.
- Native Messenger, Roleplay, catalog, provider connection, and Ripple record concepts.
- Collection-backed storage contracts for desktop and compatible remote runtimes.
- Optional Tauri desktop host for app-data storage, bundle file dialogs, provider-key secrets, and a desktop runtime bridge.
- DeKoi-owned docs and naming rules.

See [docs/project-status.md](./docs/project-status.md) for what works now, what is experimental, and what is intentionally out of scope.

## Quick Start

Install dependencies:

```sh
pnpm install
```

Run the browser development shell:

```sh
pnpm dev
```

Run the optional desktop host:

```sh
pnpm tauri:dev
```

Run fast unit tests:

```sh
pnpm test
```

Run the full local check:

```sh
pnpm check
```

For a guided setup path, see [docs/getting-started.md](./docs/getting-started.md).

## Storage Note

The browser development shell is useful for UI and runtime work, but it does not use browser storage for durable DeKoi records. Use the Tauri desktop app or configure a compatible Remote Runtime URL when persistence matters.

Desktop records are stored under:

```text
<app-data>/collections/<entity>.json
```

Desktop collection files are JSON arrays with explicit recovery behavior for
malformed files, backup sidecars, pre-repair sidecars, manual repair, stale
checks, reloads, and dropped-record warnings when individual records cannot be
normalized. See [Storage Model](./docs/storage-model.md) for the full durable
storage policy.

In-app storage, repair, bundle import/export, and provider-key tools live under
Pond Care; [docs/getting-started.md](./docs/getting-started.md) walks through
them.

## Provenance

DeKoi (no dash) is this from-scratch Apache-2.0 project. De-Koi (dashed) is the older AGPLv3 fork-derived line. [PROVENANCE.md](./PROVENANCE.md) is the one authoritative statement of what crosses that boundary: AGPLv3-derived material and legacy product naming stay out, while team-authored engineering knowledge is portable with attribution, and legacy compatibility is built as explicit one-way import adapters.

Write the DeKoi requirement before adding substantial code, and keep public labels, internal domain nouns, and legacy import aliases separate.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution rules and [AGENTS.md](./AGENTS.md) for agent workflow guidance.

## Project Docs

- [Provenance](./PROVENANCE.md): the licensing and porting boundary between DeKoi and the older De-Koi line.
- [Product Notes](./PRODUCT.md): purpose, intended users, first slice, and non-goals.
- [Design System](./DESIGN.md): active visual tokens, component guidance, and UI do/don'ts.
- [Agent Guidance](./AGENTS.md): source lanes, proof expectations, and shipping workflow.
- [Domain Model](./DOMAIN_MODEL.md): product vocabulary, naming map, record glossary, and naming guardrails.
- [Architecture Notes](./ARCHITECTURE.md): source lanes, dependency direction, and growth path.
- [Generation Macro Semantics](./docs/generation-macro-semantics.md):
  current built-in prompt macro semantics, generation wiring, dynamic variable
  persistence, active editor metadata, and reserved macro behavior.
- [Storage Model](./docs/storage-model.md): collection-backed durable data guardrails.
- [Remote Runtime Contract](./docs/remote-runtime-contract.md): compatible runtime health, invoke, generation, and storage commands.

## License

DeKoi is licensed under the [Apache License 2.0](./LICENSE). See [PROVENANCE.md](./PROVENANCE.md) for how this relates to the older De-Koi line.

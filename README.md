# DeKoi

DeKoi is a fresh, local-first story and character engine for private character conversations, scenes, and small story worlds.

This repository starts the no-dash DeKoi identity from a blank implementation. It is not a fork checkout, not a continuation repository, and not a place to copy code, assets, docs, prompts, schemas, UI text, or component layouts from the prior fork-derived line. Architecture lessons can be re-decided here only when they are written in DeKoi-owned terms.

## Status

DeKoi is an early seed. The current app proves the first native product surfaces, storage contracts, and optional desktop host path; it is not feature-complete yet.

Current highlights:

- React and TypeScript app shell for the first DeKoi product loop.
- Native Messenger, Roleplay, catalog, provider connection, and Ripple record concepts.
- Collection-backed storage contracts for desktop and compatible remote runtimes.
- Optional Tauri desktop host for app-data storage, bundle file dialogs, provider-key secrets, and a desktop runtime bridge.
- DeKoi-owned docs and naming rules that keep DeKoi separate from the old dashed project line.

See [docs/project-status.md](./docs/project-status.md) for what works now, what is experimental, and what is intentionally out of scope.

## Quick Start

Install dependencies:

~~~sh
pnpm install
~~~

Run the browser development shell:

~~~sh
pnpm dev
~~~

Run the optional desktop host:

~~~sh
pnpm tauri:dev
~~~

Run the full local check:

~~~sh
pnpm check
~~~

For a guided setup path, see [docs/getting-started.md](./docs/getting-started.md).

## Storage Note

The browser development shell is useful for UI and runtime work, but it does not use browser storage for durable DeKoi records. Use the Tauri desktop app or configure a compatible Remote Runtime URL when persistence matters.

Desktop records are stored under:

~~~text
<app-data>/collections/<entity>.json
~~~

Desktop collection files are JSON arrays. Malformed files and leftover recovery
artifacts are treated as recoverable storage errors and block autosave overwrite;
collection writes preserve a sibling `.json.bak` as a recovery aid. See
[Storage Model](./docs/storage-model.md) for the full policy.

Pond Care > Deep Water can check host readiness, save and load DeKoi-native bundles through the desktop app-data directory, check desktop collection files for outside edits, explicitly reload stored collections, and select desktop://runtime for host-backed fixture generation. Reload is blocked while local storage saves are still pending. Pond Care > Stocking can export and import bundle files through desktop dialogs; imports preview first, create a pre-import backup, then replace collections through the storage commit path. Pond Care > Catalog can save, check, and clear provider keys without exporting secret values.

## DeKoi And De-Koi

DeKoi is the no-dash, from-scratch project. De-Koi is the older dashed fork-derived line. Keep their identities separate when writing docs, code, issue text, and compatibility notes.

Compatibility work should be explicit one-way import work after DeKoi has native records:

~~~text
legacy source record -> DeKoi native record
~~~

Legacy names and old storage shapes should not become DeKoi core concepts.

## Repository Rules

- DeKoi-owned code starts here.
- Write the DeKoi requirement before adding substantial code.
- Build legacy compatibility as explicit import adapters.
- Do not copy the old repository as a source template.
- Do not copy old source code, assets, documentation wording, prompts, schemas, generated bindings, component layouts, or UI text.
- Keep public labels, internal domain nouns, and legacy import aliases separate.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution rules and [AGENTS.md](./AGENTS.md) for agent workflow guidance.

## Project Docs

- [Product Notes](./PRODUCT.md): purpose, intended users, first slice, and non-goals.
- [Design System](./DESIGN.md): active visual tokens, component guidance, and UI do/don'ts.
- [Agent Guidance](./AGENTS.md): source lanes, proof expectations, and shipping workflow.
- [Surface Labels](./SURFACE_LABELS.md): DeKoi-owned naming map.
- [Domain Model](./DOMAIN_MODEL.md): first native product records.
- [Architecture Notes](./ARCHITECTURE.md): source lanes, dependency direction, and growth path.
- [Storage Model](./docs/storage-model.md): collection-backed durable data guardrails.
- [Remote Runtime Contract](./docs/remote-runtime-contract.md): compatible runtime health, invoke, generation, and storage commands.
- [Developer Docs](./docs/developer/index.html): migrated developer docs that still need validation against the new implementation.

## License

DeKoi is licensed under the [Apache License 2.0](./LICENSE). This license applies to this DeKoi repository; it does not change the license or provenance of the older dashed project line.

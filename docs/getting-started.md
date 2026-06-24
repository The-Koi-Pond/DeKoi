# Getting Started

This guide gets DeKoi running locally and explains which paths keep data after you close the app.

## Prerequisites

Install these before running DeKoi:

- Node.js with pnpm available.
- Rust and Cargo for the optional Tauri desktop host.
- Platform prerequisites for Tauri 2 if you plan to run the desktop app.

## Install

From the repository root:

~~~sh
pnpm install
~~~

## Run The Browser Shell

~~~sh
pnpm dev
~~~

The Vite server opens the React app for browser-based development. This path is good for UI work and quick checks, but it is not the durable storage path for DeKoi records.

## Run The Desktop Host

~~~sh
pnpm tauri:dev
~~~

Use the desktop host when you need native capabilities:

- App-data collection storage.
- DeKoi bundle import and export through native file dialogs.
- Provider-key secret storage.
- The desktop runtime bridge selected as desktop://runtime.

Desktop collection records are stored under:

~~~text
<app-data>/collections/<entity>.json
~~~

## Use A Remote Runtime

A compatible runtime can provide storage and generation through the HTTP contract in [remote-runtime-contract.md](./remote-runtime-contract.md).

For the development fixture:

~~~sh
pnpm runtime:fixture
~~~

The default fixture URL is:

~~~text
http://127.0.0.1:7341
~~~

Use that URL in Pond Care > Deep Water > Remote Runtime URL. The fixture keeps storage in memory, so records disappear when the fixture process stops.

## Run Checks

Run the full local gate before proposing changes:

~~~sh
pnpm check
~~~

For a frontend build only:

~~~sh
pnpm build
~~~

Focused contract checks are also available:

~~~sh
pnpm check:storage-contracts
pnpm check:runtime-contracts
~~~

## First Launch Notes

- Start with Messenger and catalog surfaces before expecting full provider behavior.
- Use Pond Care > Deep Water to confirm the selected runtime path.
- Use Pond Care > Stocking for DeKoi-native bundle import and export.
- Use Pond Care > Catalog for provider-key checks and secret storage.
- Treat legacy compatibility as explicit import work, not automatic migration.

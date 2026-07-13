# Getting Started

This guide gets DeKoi running locally and explains which paths keep data after you close the app.

## Prerequisites

Install these before running DeKoi:

- Node.js with pnpm available.
- Rust and Cargo for the optional Tauri desktop host.
- Platform prerequisites for Tauri 2 if you plan to run the desktop app.

## Install

From the repository root:

```sh
pnpm install
```

## Run The Browser Shell

```sh
pnpm dev
```

The Vite server opens the React app for browser-based development. This path is good for UI work and quick checks, but it is not the durable storage path for DeKoi records.

## Run The Desktop Host

```sh
pnpm tauri:dev
```

Use the desktop host when you need native capabilities:

- App-data collection storage.
- DeKoi bundle import and export through native file dialogs.
- Provider-key secret storage.
- The desktop runtime bridge selected as desktop://runtime for durable storage
  and required-key provider-backed generation.

Desktop collection records are stored under:

```text
<app-data>/collections/<entity>.json
```

Desktop collection files must be JSON arrays. If a collection file is empty,
invalid, non-array JSON, or missing while `.json.bak`, legacy `.json.tmp`,
unique `.json.write-*.tmp`, or `.json.pre-repair` recovery artifacts exist,
desktop storage reports a recoverable error and blocks normal autosave
overwrite. Collection writes keep a `.json.bak` sibling as a recovery aid. Pond Care can explicitly repair one
malformed desktop collection at a time by restoring a valid backup or, when no
restorable backup exists, replacing it with an empty collection. The malformed
bytes remain in `.json.pre-repair` until the user finishes the repair.

If any collection fails to load, Pond Care lists every failed collection and
its error under **Collection load errors**. This works for both desktop storage
and remote runtimes; desktop repair metadata is not required for the alert. A
failed manual reload keeps the last successfully loaded records in the app.
Retry **Reload records** after fixing the storage problem; a healthy current
reload clears the collection alerts.

If Pond Care warns that unreadable records were skipped during load, restore a
backup bundle before editing those collections. DeKoi blocks saves for affected
collections, including paired Messenger or Roleplay transcript collections, so a
whole-collection save cannot silently erase the skipped records.

## Use A Remote Runtime

A compatible runtime can provide storage, provider checks, and model listing
through the HTTP contract in
[remote-runtime-contract.md](./remote-runtime-contract.md). Messenger and
Roleplay generation currently use the provider transport described in
[runtime-model.md](./runtime-model.md).

For the development fixture:

```sh
pnpm runtime:fixture
```

The default fixture URL is:

```text
http://127.0.0.1:7341
```

Use that URL in Pond Care > Data & Backup > Remote Runtime URL. The fixture
keeps storage in memory, so records disappear when the fixture process stops.
Pond Care's runtime check reports timeout or fetch failure detail for
unreachable remote runtimes, with bearer/basic authorization details and URL
userinfo redacted.

## Run Checks

Run the full local gate before proposing changes:

```sh
pnpm check
```

For a frontend build only:

```sh
pnpm build
```

For fast engine and storage unit tests:

```sh
pnpm test
```

For Playwright browser end-to-end smoke tests:

```sh
pnpm test:ui
```

The committed Playwright specs live in `tests/e2e` and are split by workflow:
app shell, provider generation, storage bundles, storage state, and transcript
storage.

Remote-runtime e2e coverage does not need the development fixture process. The
shared helpers in `tests/e2e/app-test-utils.ts` install a Playwright route for
`http://dekoi-runtime.test/api/invoke`, keep fake runtime storage in memory,
and expose failing or deferred storage paths for race and recovery checks.

Focused checks for narrow changes are mapped to change types in
[AGENTS.md](../AGENTS.md) under Validation.

## First Launch Notes

- Start with catalog records, then Messenger or Roleplay threads. Roleplay has
  native thread settings and send guards, but deeper scene-specific polish is
  still early.
- In macro-resolved Companion, Persona, Prompt Preset, and Lorebook multiline
  fields, use the Macros button to browse and insert currently supported prompt
  macro syntax. Companion and Persona fields show an inline preview while the
  field is active or the Macros browser is open; Prompt Preset fields and
  Lorebook entry bodies remain insert-only because their preview needs active
  generation context. Companion greeting fields stay plain text today.
- Use Pond Care > Data & Backup to confirm the selected runtime path.
- Use Pond Care > Generation for default model parameters, global lorebooks, and
  lore insertion strategy.
- Use the Presets catalog for reusable Messenger and Roleplay prompt sources,
  current sampling controls, and structured Roleplay section/group editing,
  then select a prompt preset from thread settings. New threads start with the
  current app default. The bundled Universal V2 starter is an ordinary native
  preset that can be edited or duplicated. It becomes deletable after another
  preset is designated as default, but that designation control is not exposed
  in the catalog yet. The default and last preset cannot be deleted.
  Roleplay sections can be
  ordered, grouped, enabled or disabled, assigned provider roles, wrapped, and
  placed at transcript depth; marker sections insert saved Roleplay context,
  including conversation history through an enabled Chat History marker.
  Messenger uses the preset's Messenger prompt source when present, falls back
  to the preset system prompt, and lets a non-empty edited Messenger Prompt
  override both for that thread. The catalog can add, remove, and reorder
  reusable choice blocks and options; edit defaults, questions, option
  descriptions, multi-select separators, manual or alphabetical option order,
  button/list/automatic presentation. Choice questions are always visible.
  Compatible data may carry static variables, richer
  parameters, and metadata that the catalog preserves even when those fields do
  not have visible editors yet. Roleplay generation consumes saved section/group
  structure when present. Both Messenger and Roleplay generation consume stored
  stable-ID choices and retain independent confirmed-choice histories when a
  thread switches presets. In Roleplay settings, Prompt Preset > Edit opens Preset
  Variables for the selected preset; New remains the secondary action for
  creating another preset. Questions and option descriptions appear with the
  choices. Ordered multi-select choices feed request-local
  prompt variables during generation, and using the preset default removes the
  thread override. The Presets catalog can import a compatible `.json` or
  `.marinara.json` package as a new preset and export the selected saved preset
  as `Preset Name.json`. These single-preset files are separate from Pond Care
  backups. Browser imports without a configured storage target are session-only
  and show that warning in the catalog.
- Use Pond Care > Data & Backup for DeKoi-native bundle import and export.
  Imports preview first, require confirmation, create a pre-import backup, and
  then replace collections through the storage commit path.
- Use the Connections catalog for provider-key checks and secret storage.
- Required-key provider generation needs the desktop app so saved keys can stay
  in the desktop key store; browser mode can still use compatible no-key/local
  provider paths with a configured Base URL and model.
- Treat legacy compatibility as explicit import work, not automatic migration.
  The current legacy import adds converted native companions, personas,
  provider connections, Messenger records, and macro variable scopes after the
  same backup and commit flow. The preview shows macro variable scope and
  variable counts, and warns when imported global variables will overwrite
  same-name current globals.

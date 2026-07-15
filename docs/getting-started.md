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
app shell, provider generation, prompt presets, preset variables, storage
bundles, and storage state.

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
- Use a Lorebook entry's advanced Generation triggers and Companion filter to
  restrict ordinary-send activation to selected reply targets. Imported trigger
  actions that DeKoi cannot initiate yet and unavailable companion IDs remain
  preserved until you explicitly change or clear those restrictions. Exact
  activation semantics live in [storage-model.md](./storage-model.md).
- Use the Presets catalog for reusable Messenger and Roleplay prompt sources,
  optional generation parameters, and structured Roleplay section/group editing.
  Every parameter has its own **Send** control: off means the preset deliberately
  omits that field; on requires a valid value. Anthropic requests additionally
  require Maximum Output Tokens to be sent because that provider has no default.
  After editing, select a prompt preset from thread settings. New threads start with the
  current app default. A title is enough to create and save a preset; prompt
  text, variables, metadata, parameters, and structured recipe rows may all be
  absent. A blank System Prompt stays blank in storage rather than receiving a
  built-in prompt. The bundled Universal V2 starter is an ordinary native
  preset that can be edited or duplicated. **Restore Starter Preset**, available
  in the Presets rail and the empty Presets surface, adds a fresh copy of the
  exact bundled starter without replacing existing presets or changing the app
  default or any thread. It becomes deletable after another preset is designated
  as default, but that designation control is not exposed in the catalog yet.
  The default and last preset cannot be deleted. Create, Restore Starter Preset,
  and Save Changes finish only after the complete prompt-preset catalog is
  stored; failures are shown without navigating away. DeKoi asks before
  discarding a dirty preset when navigating, opening a
  thread, changing the runtime target, reloading, importing, or restoring data.
  While a preset save is running, its fields and save controls are disabled and
  leaving is blocked; closing or reloading a browser tab uses the browser's
  native confirmation.
  Roleplay sections can be
  ordered, grouped, enabled or disabled, assigned provider roles, wrapped, and
  placed at transcript depth; marker sections insert saved Roleplay context,
  including conversation history through an enabled Chat History marker.
  Messenger ordinary conversation settings select a prompt preset and its
  preset-authored Variables. Generation uses the selected preset's
  `messengerPrompt`, then shared `systemPrompt`, and falls back to the built-in
  `DEFAULT_MESSENGER_SYSTEM_PROMPT` when no usable selected preset prompt exists;
  Roleplay uses usable sections, then the shared prompt, then its built-in
  prelude. Roleplay sections never become Messenger's shared prompt. These
  built-in fallbacks are assembled only for generation. A selected Roleplay
  preset retains its narration and other-character output behavior through the
  fallback chain; only no-preset, single-character Roleplay uses the
  one-character output contract. Conversations have no arbitrary prompt or
  model-parameter override. The catalog can add, remove, and reorder reusable
  choice blocks and options; edit defaults, questions, option descriptions,
  multi-select separators, manual or alphabetical option order, and
  button/list/automatic presentation. Choice questions are always visible.
  Compatible data may carry static variables, richer parameters, and metadata
  that the catalog preserves even when those fields do not have visible editors
  yet. Roleplay generation consumes usable saved section/group structure. Both
  Messenger and Roleplay generation consume stored stable-ID choices and retain
  independent confirmed-choice histories when a thread switches presets.
  Selecting a variable-bearing preset for the first
  time opens Preset Variables in both modes and leaves the previous preset
  active until Confirm or Use Defaults; Cancel discards the draft. New threads
  whose default preset has variables open settings immediately, and generation
  stays blocked until those variables are confirmed. Choice-free presets are
  confirmed without a dialog. Messenger's Variables action and Roleplay's
  Prompt Preset > Edit action reopen the active preset's saved choices. Questions
  and option descriptions appear with the choices. Ordered multi-select choices
  feed request-local prompt variables during generation, and Use Defaults copies
  the preset's current defaults into the thread history. Invalid saved choices
  are repaired from valid defaults and reported even when settings was closed.
  The Presets catalog can import a compatible `.json` or
  `.marinara.json` package as a new preset and export the selected saved preset
  as `Preset Name.json`, including promptless packages. These single-preset
  files are separate from Pond Care backups. Browser imports without a
  configured storage target are session-only and show that warning in the
  catalog.
- Use Pond Care > Data & Backup for DeKoi-native bundle import and export.
  Imports preview first, require confirmation, create a pre-import backup, and
  then replace collections through the storage commit path. Native bundles use
  schema version 2 with unified mode-thread and mode-message collections. Local
  development data from the removed split collections must be reset; it is not
  migrated as a native bundle.
- Use the Connections catalog for provider-key checks and secret storage.
- Required-key provider generation needs the desktop app so saved keys can stay
  in the desktop key store; browser mode can still use compatible no-key/local
  provider paths with a configured Base URL and model.
- Treat legacy compatibility as explicit import work, not automatic migration.
  The current legacy import adds converted native companions, personas,
  provider connections, Messenger records, and macro variable scopes after the
  same backup and commit flow. The preview shows macro variable scope and
  variable counts, and warns when imported global variables will overwrite
  same-name current globals. Only recognized legacy Messenger records are
  converted; unsupported Roleplay records are skipped, and lorebook/preset
  references are cleared because those resources are not imported.

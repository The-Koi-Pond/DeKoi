# Core Features Handoff

Last updated: 2026-06-28

This is the current development handoff for DeKoi core features. It replaces the
older "build these eight features in order" plan. DeKoi has moved past the first
Messenger-only seed: Messenger is still the first polish target, but Roleplay,
desktop storage, split transcript collections, provider secrets, bundle import,
legacy import, and provider-backed generation all now exist in early form.

Use this document with:

- `AGENTS.md` for source lanes and proof requirements.
- `ARCHITECTURE.md` for dependency direction.
- `docs/storage-model.md` for durable record and collection rules.
- `docs/remote-runtime-contract.md` for runtime command contracts.

## Current State

DeKoi is an early local-first React/Tauri app with:

- Pond shell, Bank, Shoal, Waterline, Tide, Pond Care, catalog rails, and current
  Messenger/Roleplay thread surfaces.
- Native engine records for app settings, companions, personas, lorebooks,
  provider connections, Messenger threads/messages, Roleplay threads/entries,
  and Ripples.
- Collection-backed storage through desktop or compatible remote runtime
  commands.
- Split transcript storage: Messenger message rows and Roleplay entry rows are
  separate collections from thread metadata.
- Dirty-collection autosave, legacy embedded transcript migration on load, and
  explicit import commits.
- DeKoi-native JSON bundle export/import, desktop file dialogs, pre-import
  backup, import preview, and partial-failure reporting.
- One-way legacy thread import into native Messenger threads.
- Desktop provider-key secrets scoped to connection/provider/base URL.
- Provider connection check and model-fetch commands.
- Provider-neutral generation request assembly for Messenger and Roleplay.
- Mock generation, browser provider adapters, remote runtime invocation, and
  desktop runtime provider transport for a narrow set of provider families.
- Ripple engine records/actions/storage and bundle support, but no dedicated
  routed Ripple editor surface yet.

Important current bias:

- Messenger remains the first product loop to polish.
- Roleplay is no longer only reserved; it has a working first chat-like slice,
  but it is less complete than Messenger and still lacks full scene/settings UX.
- Rust/Tauri is no longer "later"; the optional desktop host already owns app
  data storage, bundle file dialogs, provider secrets, and desktop runtime
  dispatch.
- Browser development mode is useful for UI work, but durable app records need
  the desktop runtime or a compatible remote runtime.
- Generation routing is still uneven: inside the desktop app, provider-backed
  generation uses the desktop runtime path; browser mode has a direct provider
  fallback and remote-runtime command paths for storage/check/model commands.
- Legacy import is compatibility only. Old names, prompts, UI copy, schemas, and
  product concepts must not become native DeKoi concepts.

## Current Source Map

Use current paths, not older seed paths:

- App composition and storage sync:
  - `src/app/AppRoot.tsx`
  - `src/app/use-app-controller.ts`
  - `src/app/use-app-state.ts`
  - `src/app/use-app-storage-sync.ts`
- Engine records and pure behavior:
  - `src/engine/app-settings.ts`
  - `src/engine/character.ts`
  - `src/engine/persona.ts`
  - `src/engine/lorebook.ts`
  - `src/engine/provider-connection.ts`
  - `src/engine/messenger.ts`
  - `src/engine/messenger-actions.ts`
  - `src/engine/messenger-generation.ts`
  - `src/engine/roleplay.ts`
  - `src/engine/roleplay-actions.ts`
  - `src/engine/roleplay-generation.ts`
  - `src/engine/ripples.ts`
  - `src/engine/ripple-actions.ts`
- Feature UI:
  - `src/features/shell/*`
  - `src/features/modes/messenger/MessengerThread.tsx`
  - `src/features/modes/roleplay/RoleplayThread.tsx`
  - `src/features/catalog/*`
  - `src/features/navigation/*`
- Feature runtime workflows:
  - `src/features/runtime/generation/*`
  - `src/features/runtime/storage/*`
  - `src/features/runtime/ripples/*`
- Storage runtime:
  - `src/runtime/storage/storage-entities.ts`
  - `src/runtime/storage/app-storage-snapshot.ts`
  - `src/runtime/storage/app-storage-collection-projection.ts`
  - `src/runtime/storage/collections/*`
  - `src/runtime/storage/bundles/*`
  - `src/runtime/storage/storage-repository*.ts`
  - `src/runtime/storage/host-storage.ts`
- Host and runtime APIs:
  - `src/shared/api/runtime-commands.ts`
  - `src/shared/api/desktop-commands.ts`
  - `src/shared/api/remote-runtime*.ts`
  - `src/shared/api/desktop-runtime.ts`
  - `src/shared/api/desktop-provider-secrets.ts`
  - `src/shared/api/desktop-bundle-file.ts`
- Tauri host:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/storage.rs`
  - `src-tauri/src/runtime.rs`
  - `src-tauri/src/secrets.rs`
  - `src-tauri/src/file_dialog.rs`
  - `src-tauri/src/host.rs`

## Near-Term Priority

Build in this order unless Xel redirects:

1. Harden split transcript storage and migration recovery.
2. Harden provider connection UX and provider-backed generation errors.
3. Polish Messenger thread settings, send/edit/delete, and missing-reference UX.
4. Bring Roleplay closer to Messenger parity while keeping mode records separate.
5. Harden catalog record validation, deletion cleanup, and empty states.
6. Keep native bundle import/export and legacy import reliable after storage
   changes.
7. Keep desktop/remote runtime contracts documented and checked.
8. Update stale docs when implementation paths or product status change.

## 1. Storage And Persistence

Status: active and recently changed. Storage is collection-backed, with split
Messenger/Roleplay transcript collections.

Current collections:

- `app-settings`
- `characters`
- `personas`
- `lorebooks`
- `provider-connections`
- `roleplay-threads`
- `roleplay-entries`
- `messenger-threads`
- `messenger-messages`
- `ripple-states`

Key behavior:

- Thread metadata and transcript rows are saved separately.
- UI and generation still consume assembled `MessengerThread` and
  `RoleplayThread` objects.
- Legacy embedded `messages` and `entries` are normalized and migrated into
  split collections on load or import commit.
- App storage sync tracks dirty collections, debounces, schedules idle writes,
  and serializes one `storage_replace` per dirty collection.
- Desktop collection metadata supports explicit stale checks and manual reload;
  external file edits are not hot-loaded or merged.
- Imports cancel pending autosave work, wait for active saves, and commit through
  explicit collection replacement.
- Desktop malformed collection files are recoverable storage errors and block
  normal autosave overwrite.
- Pond Care can explicitly repair one malformed desktop collection at a time by
  restoring a valid `.json.bak` or, when no restorable backup exists, replacing
  it with an empty collection; malformed bytes stay in `.json.pre-repair` until
  the user finishes the repair.

Next work:
- Keep migration signatures correct when user edits happen during legacy
  transcript migration.
- Keep transcript activity ordering based on message/entry activity helpers, not
  thread `updatedAt` alone.
- Avoid adding database details until a repository implementation can sit behind
  `storage-repository-factory.ts`.

Acceptance:

- New Messenger messages dirty only `messenger-messages`.
- New Roleplay entries dirty only `roleplay-entries`.
- Legacy embedded transcripts load, render, and migrate into split collections.
- Corrupt desktop collection files are reported clearly and not overwritten by
  autosave.

## 2. Messenger

Status: working first product loop, still the primary polish target.

Implemented:

- Create Messenger threads from The Shoal with selected companions, persona,
  and connection.
- Save/reopen threads.
- Send persona or anonymous messages.
- Generate companion replies through mock or provider runtime.
- Edit and delete messages.
- Configure thread participants, persona, lorebooks, connection, and custom
  Messenger prompt through the Shoal chat settings rail.
- Show missing/deleted references gracefully in several paths.

Next work:

- Finish polish on thread settings states, including disabled/empty cases and
  clearer missing-reference summaries.
- Review custom system prompt UX and make sure it is Messenger-specific.
- Improve generated-reply warnings so provider failures are understandable to a
  nontechnical user.
- Keep Messenger UI out of Roleplay internals and keep prompt assembly in
  `src/engine/messenger-generation.ts`.

Acceptance:

- A user can create a Messenger thread, send a message, get a reply, edit/delete
  messages, reload, and continue.
- Selected companion/persona/lorebook/connection records influence the
  generation request.
- Missing records produce warnings or visible empty states, not crashes.

## 3. Roleplay

Status: first native slice exists. It is no longer purely reserved, but it is
still less complete than Messenger.

Implemented:

- Native `RoleplayThread` and `RoleplayEntry` records.
- Roleplay thread creation from The Shoal with companions, persona, lorebooks,
  and connection.
- Save/reopen Roleplay threads.
- Send persona or narration entries.
- Generate a character turn through the shared provider-neutral generation
  boundary.
- Edit and delete entries.
- Split `roleplay-entries` collection with assembly before UI/generation.

Next work:

- Build actual Roleplay settings UX instead of the disabled header settings
  button in the thread surface.
- Decide which scene fields are first-class UI, not just stored fields.
- Improve scene framing, speaker presentation, and continuation controls.
- Keep Roleplay records separate from Messenger where presentation/continuity
  differs.

Acceptance:

- A user can create a Roleplay thread, write an entry, generate a character
  turn, edit/delete entries, reload, and continue.
- Roleplay generation uses selected companions/persona/lorebooks/connection.
- Roleplay does not import Messenger UI internals.

## 4. Catalog Records

Status: editable native records exist for companions, personas, lorebooks, and
provider connections.

Implemented:

- Catalog rails and editor surfaces for companions, personas, lorebooks, and
  connections.
- Record creation, update, delete, and duplication helpers where useful.
- Delete cleanup for references from Messenger/Roleplay threads and characters.
- Provider connection secret handling through action hooks and desktop secret
  wrappers.
- Provider connection check and model fetch.

Next work:

- Harden validation and field-level error states.
- Keep provider secret values out of records, bundles, local browser state, and
  logs.
- Improve empty catalog states and first-run affordances.
- Decide when prompt presets/Currents become real records; do not smuggle them
  into provider connections or threads prematurely.

Acceptance:

- A user can create/edit/delete core catalog records without touching sample
  constants.
- Deleting a referenced record cleans relationships or shows a clear missing
  state.
- Exported provider connections never include API key material.

## 5. Generation And Providers

Status: provider-neutral generation is real but narrow.

Implemented:

- `src/engine/generation.ts` shared request helpers.
- Messenger request assembly in `src/engine/messenger-generation.ts`.
- Roleplay request assembly in `src/engine/roleplay-generation.ts`.
- Mock generation adapters for development.
- Provider generation workflow under `src/features/runtime/generation`.
- Browser provider fallback for optional/no-key cases.
- Desktop runtime provider calls with stored API key lookup for required-key
  providers.
- Provider connection check and model listing commands.

Supported provider work is intentionally bare-minimum. Current adapters cover
OpenAI-compatible providers plus Anthropic and Google-style endpoints. Treat
each provider as experimental until checked with a real endpoint.

Next work:

- Improve provider-specific response parsing and empty/refusal warnings.
- Make provider errors concise and actionable in Messenger and Roleplay.
- Keep generation commands separate from storage commands.
- Keep provider secrets behind desktop secret capabilities.
- Add durable tests only for risky contracts or known regressions.

Acceptance:

- Generation request payloads contain DeKoi-native records and provider-neutral
  `promptMessages`.
- Unknown generated companion IDs are dropped with a warning.
- Required-key providers fail clearly when no desktop secret is available.

## 6. Bundle Import, Export, And Legacy Import

Status: native bundle import/export and one-way legacy thread import are
implemented.

Implemented:

- Native bundle export includes all current collections, including split
  transcript collections.
- Native bundle import validates kind/schema, normalizes collections, previews
  counts, skips invalid records when possible, requires confirmation, creates a
  pre-import backup, and commits through explicit collection replacement.
- Desktop bundle export/import can use native file dialogs.
- Provider secret fields are redacted on export and skipped with warnings on
  import.
- Legacy thread import previews supported previous thread/localStorage shapes,
  then appends converted native Messenger records through the same backup and
  commit path.
- Orphan Ripple states are skipped during bundle import.

Next work:

- Keep bundle schema docs aligned with storage collection changes.
- Improve partial import recovery UX.
- Add repair/import flows only with explicit user confirmation.
- Keep legacy import labels isolated to import-source descriptions.

Acceptance:

- Exported JSON is readable and excludes provider secrets.
- Import previews counts before replacing data.
- Import never overwrites without confirmation and pre-import backup attempt.
- Partial failures name the failed collection and do not claim automatic
  rollback.

## 7. Desktop And Remote Runtime

Status: both exist as runtime targets.

Implemented:

- Remote HTTP fixture: `pnpm runtime:fixture`.
- HTTP runtime contract:
  - `GET /health?probe=1`
  - `POST /api/invoke`
- Desktop runtime target: `desktop://runtime`.
- Shared runtime command allowlist:
  - `generation_generate`
  - `provider_connection_check`
  - `provider_connection_models`
  - `storage_list`
  - `storage_replace`
  - `storage_create`
  - `storage_update`
  - `storage_delete`
- Desktop Tauri commands for host status, storage bundles, bundle file dialogs,
  provider secrets, runtime health, and runtime invoke.

Next work:

- Keep `src/shared/api/runtime-commands.ts`, fixture commands, Rust runtime
  dispatch, and docs in sync.
- Keep `src/shared/api/desktop-commands.ts`, Rust command registration, and
  capability docs in sync.
- Keep desktop-only storage metadata documented as optional for compatible
  remote runtimes.
- Avoid adding raw Tauri `invoke` or raw runtime `fetch` calls inside feature UI.

Acceptance:

- `pnpm check:runtime-contracts` passes after runtime command changes.
- `pnpm check:desktop-contracts` passes after desktop command changes.
- Remote fixture and desktop runtime expose the same command names where
  applicable.

## Verification Commands

Use the smallest check that proves the changed lane:

```sh
pnpm check:storage-contracts
pnpm check:provider-secret-safety
pnpm check:runtime-contracts
pnpm check:desktop-contracts
pnpm check:frontend-boundaries
pnpm build
pnpm lint
pnpm check:rust
```

Run the full local gate before shipping or ready-for-review handoff:

```sh
pnpm check
```

For the remote fixture:

```sh
pnpm runtime:fixture
```

For a quick Vite root smoke check while the dev server is running:

```sh
node --input-type=module -e "const r=await fetch('http://127.0.0.1:5173/'); const t=await r.text(); console.log({status:r.status, hasRoot:t.includes('<div id=\"root\"></div>')})"
```

Adjust the port if Vite selected another one.

## Commit Guidance

Keep commits small and named around product slices or contracts, for example:

- `storage: split messenger transcript rows`
- `runtime: harden provider connection checks`
- `messenger: polish thread settings`
- `roleplay: wire scene generation warnings`

Do not bundle unrelated UI polish, storage changes, runtime changes, and docs
rewrites into one commit unless the user explicitly asks for a broad sync.

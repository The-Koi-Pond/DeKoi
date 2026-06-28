# Storage Model

This document is the storage guardrail for DeKoi-native records. It is not a SQL
migration plan. The goal is to keep durable data shaped by product ownership
before the app grows enough to need a heavier database implementation.

## Decision

DeKoi storage is collection-backed first.

Current desktop storage writes JSON arrays under:

```text
<app-data>/collections/<entity>.json
```

Remote runtimes expose the same entities through explicit storage commands:

- `storage_list`
- `storage_replace`
- `storage_create`
- `storage_update`
- `storage_delete`

If DeKoi later uses SQLite or another database, that database is an
implementation detail behind the same DeKoi record contracts. It should not
leak table-driven names into UI, engine records, provider requests, or import
adapters.

## Current Collections

| Entity | Native owner | Record | Runtime adapter |
| --- | --- | --- | --- |
| `app-settings` | `src/engine/app-settings.ts` | `AppSettings` | `src/runtime/storage/collections/app-settings.ts` |
| `characters` | `src/engine/character.ts` | `CharacterRecord` | `src/runtime/storage/collections/character-storage.ts` |
| `roleplay-threads` | `src/engine/roleplay.ts` | `RoleplayThreadRecord` | `src/runtime/storage/collections/roleplay-storage.ts` |
| `roleplay-entries` | `src/engine/roleplay.ts` | `RoleplayEntry` | `src/runtime/storage/collections/roleplay-entry-storage.ts` |
| `lorebooks` | `src/engine/lorebook.ts` | `LorebookRecord` | `src/runtime/storage/collections/lorebook-storage.ts` |
| `messenger-threads` | `src/engine/messenger.ts` | `MessengerThreadRecord` | `src/runtime/storage/collections/messenger-storage.ts` |
| `messenger-messages` | `src/engine/messenger.ts` | `MessengerMessage` | `src/runtime/storage/collections/messenger-message-storage.ts` |
| `personas` | `src/engine/persona.ts` | `PersonaRecord` | `src/runtime/storage/collections/persona-storage.ts` |
| `provider-connections` | `src/engine/provider-connection.ts` | `ProviderConnectionRecord` | `src/runtime/storage/collections/provider-connection-storage.ts` |
| `ripple-states` | `src/engine/ripples.ts` | `RippleState` | `src/runtime/storage/collections/ripple-state-storage.ts` |

## Source Of Truth

The frontend registry is the TypeScript source of truth for DeKoi storage entity
names:

- `src/runtime/storage/storage-entities.ts`

The public collection entity type is `StorageEntity`. `HostStorageEntity`
remains a compatibility alias for host-backed storage code.

Runtime collection adapters live under `src/runtime/storage/collections`;
durable product record shapes live under `src/engine`.
App-wide load/save orchestration lives in
`src/runtime/storage/app-storage-snapshot.ts`.
Bundle import/export and legacy import normalization live under
`src/runtime/storage/bundles`.

Generic JSON reader helpers for storage/import normalization live in
`src/runtime/storage/storage-json.ts`. Product-specific normalization stays in the
owning runtime adapter for each collection.

Runtime collection adapters use the `StorageCollectionRepository` contract in
`src/runtime/storage/storage-repository.ts`, re-exported through the runtime public
entrypoint in `src/runtime/index.ts`. The repository contract exposes full
collection replacement through `replace`, and host-backed `save` currently uses
the same replacement path. Collection adapters create repositories through
`src/runtime/storage/storage-repository-factory.ts`; the current host-backed
implementation lives behind that factory in `src/runtime/storage/host-storage.ts`.
Future SQLite or database-backed storage should implement the same repository
shape behind the factory rather than leaking database details into feature code,
collection adapters, or engine records.
The shared repository module also owns storage result aggregation, so snapshot
and import/export orchestration can combine adapter outcomes without depending
on a concrete host implementation.

App-wide save orchestration in `src/app/use-app-storage-sync.ts` tracks dirty
collections instead of fanning every save out to every collection. It debounces
rapid state changes, schedules writes during idle time, sends one
`storage_replace` per dirty collection, and serializes collection writes so a
collection cannot have overlapping saves.

Desktop collection files expose explicit per-collection metadata:

- entity
- file existence
- byte length
- updated-at milliseconds
- content hash

The app stores the metadata from the last loaded or app-written snapshot as a
staleness baseline. Pond Care > Deep Water can check the current desktop
metadata and report when collection files changed outside DeKoi, but the app
does not hot-load or merge those files. Remote runtime targets do not need to
provide comparable metadata; stale checks report metadata as unavailable there.
Reload is an explicit user action that reloads records from the active runtime
target. Reload is blocked while local collection saves are pending, active, or
failed-unsaved, so external data cannot replace in-memory changes while DeKoi
still has local storage work.

Messenger and Roleplay transcripts are stored separately from thread metadata.
The UI still receives assembled `MessengerThread` and `RoleplayThread` objects,
but storage projection strips `messages` from `messenger-threads` and `entries`
from `roleplay-threads`. Message-only or entry-only edits dirty
`messenger-messages` or `roleplay-entries`, so new transcript items do not
rewrite whole thread records. Runtime adapters still normalize legacy embedded
messages/entries and migrate them into the split collections on the next save or
explicit import commit.
After this split, thread `updatedAt` means thread metadata changed; activity
ordering should use `getMessengerThreadActivityAt` or
`getRoleplayThreadActivityAt`.

## Desktop JSON Safety

Desktop collection files are JSON arrays. Missing files load as empty
collections only when no sibling recovery artifacts are present. Empty files,
invalid JSON, non-array JSON, and missing files with `.json.bak` or `.json.tmp`
siblings are recoverable storage errors, not empty collections.

When a desktop collection file is malformed, the desktop runtime reports the
entity name, path category, whether `.json.bak` or `.json.tmp` siblings exist,
and that writes are blocked. Normal autosave must not overwrite that collection
until a future explicit repair/import path repairs or replaces the corrupt file.

Desktop collection JSON writes use a sibling temp file and a `.json.bak`
sibling:

- serialize to `<entity>.json.tmp`
- write and sync the temp file
- preserve the readable current file as `<entity>.json.bak`
- install the temp file
- restore the backup when install fails and a backup is available
- best-effort sync the final file and parent directory

DeKoi storage bundle files use the same temp-file write and sync path, but they
do not create `.json.bak` siblings.

The backup is a recovery aid, not a user-facing repair workflow. Future repair
commands should restore, quarantine, or replace collection files only after
explicit user confirmation.

## Import Commit Safety

DeKoi bundle import is a two-step flow: preview first, then explicit commit after
confirmation. Accepted DeKoi-native bundles are persisted through
`replaceAppStorageSnapshot`, which replaces known collections in a fixed order
instead of relying on React state changes and the autosave effect.

Before committing an import, the Care UI creates a pre-import DeKoi bundle
backup. In the desktop app, this uses the awaitable desktop save dialog and the
import is not started if the save is cancelled or fails. In a browser-only
session, DeKoi can only request a JSON download, so the UI describes that backup
as browser-saved instead of verified.

If a collection replace fails, the import result reports the failed collection,
records how many collections were replaced before the failure, marks partial
commits as requiring a reload, reloads persisted storage so React state reflects
the partial durable state, and states that automatic rollback is not implemented
yet. Legacy converted-thread imports add native Messenger records to the current
snapshot and use the same explicit commit path instead of relying on autosave.
Because that path commits a complete current snapshot, pending changes in other
collections are persisted along with the converted Messenger threads.

The desktop host keeps a Rust allowlist for local file access:

- `src-tauri/src/storage.rs`

Run this check after any collection change:

```sh
pnpm check:storage-contracts
```

The check fails if the TypeScript registry, TypeScript semantic alias map, Rust
allowlist, or documented collection table drift. It also verifies each
documented native owner file exists and names the documented record type, and
that each documented runtime adapter uses the expected repository entity alias.

## Record Rules

- Every durable product record uses a DeKoi-owned noun.
- Every durable product record carries `id`, `schemaVersion`, `createdAt`, and
  `updatedAt` unless the record is explicitly documented as singleton settings.
- Each collection has one native owner. UI code may request changes, but it does
  not define the durable shape.
- Runtime adapters may normalize unknown JSON into native records, but they do
  not invent product meaning.
- Provider-specific metadata stays out of core thread/message records unless it
  is wrapped in a DeKoi-owned field with a documented purpose.
- Provider secrets are not ordinary collection data and must not be exported in
  DeKoi bundles.
- `provider-connections` rows store provider metadata only. Typed API keys are
  accepted at the editor/action boundary and saved through the desktop provider
  secret capability when available.
- Desktop loads verify `ready` required-key provider connections against the
  desktop secret store. If the saved key is missing or cannot be checked, the
  row loads as `needs-key`.
- Saved desktop provider secrets are scoped to the connection provider and base
  URL. Changing either field requires a newly typed key instead of silently
  reusing the previous secret.

## Relationship Rules

Relationships are stored as IDs. Cleanup is implemented by the owner action or
storage adapter, not by UI components.

Current relationships:

| From | Field | Points to | Cleanup expectation |
| --- | --- | --- | --- |
| `messenger-threads` | `characterIds[]` | `characters.id` | Deleted characters are removed from thread participants. |
| `messenger-threads` | `activePersonaId` | `personas.id` | Deleted personas clear the active persona. |
| `messenger-threads` | `lorebookIds[]` | `lorebooks.id` | Deleted lorebooks are removed from thread context. |
| `messenger-threads` | `providerConnectionId` | `provider-connections.id` | Deleted connections clear the selected connection. |
| `messenger-messages` | `threadId` | `messenger-threads.id` | Deleting a Messenger thread removes its messages from the projected message collection. |
| `roleplay-threads` | `characterIds[]` | `characters.id` | Deleted characters are removed from scene participants. |
| `roleplay-threads` | `activePersonaId` | `personas.id` | Deleted personas clear the active persona. |
| `roleplay-threads` | `lorebookIds[]` | `lorebooks.id` | Deleted lorebooks are removed from scene context. |
| `roleplay-threads` | `providerConnectionId` | `provider-connections.id` | Deleted connections clear the selected connection. |
| `roleplay-entries` | `threadId` | `roleplay-threads.id` | Deleting a Roleplay thread removes its entries from the projected entry collection. |
| `characters` | `lorebookIds[]` | `lorebooks.id` | Deleted lorebooks are removed from character context. |
| `ripple-states` | `ownerId` | `messenger-threads.id` or `roleplay-threads.id` | Orphaned ripple states are skipped on bundle import. |

## Import And Export

DeKoi-native bundle import/export is the durable interchange path. It should:

- Validate bundle kind and schema version.
- Normalize each collection independently.
- Preview counts before replacing local data.
- Skip invalid records with clear warnings when possible.
- Keep legacy import separate from native bundle import.
- Keep provider secret values outside exported JSON.
- Include `roleplay-entries` and `messenger-messages` as separate bundle arrays;
  imported legacy bundles with embedded transcript data are normalized into the
  split collections.
- Redact legacy or hand-edited provider secret fields during bundle import and
  warn that those fields were skipped.
- Import required-key provider connections as `needs-key` unless a desktop
  secret is re-entered through the provider connection editor.

Legacy import remains one-way:

```text
legacy source record -> DeKoi native record
```

Import adapters may understand old source names. Engine records, collection
names, UI labels, and provider requests should stay DeKoi-native.

## Future Storage Work

1. Add a database-backed repository implementation behind
   `src/runtime/storage/storage-repository-factory.ts` when DeKoi needs a real
   database.
2. Move desktop storage into a dedicated capability module or crate once record
   repair, cleanup, or profile import makes `src-tauri/src/storage.rs` too broad.

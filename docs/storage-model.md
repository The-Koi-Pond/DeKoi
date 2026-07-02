# Storage Model

This document is the storage guardrail for DeKoi-native records. It is not a SQL
migration plan. The goal is to keep durable data shaped by product ownership
before the app grows enough to need a heavier database implementation.

For longer-term storage direction, see [Storage Roadmap](./storage-roadmap.md).
The roadmap is not an enforceable contract unless this document and the storage
contract check are updated.

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
| `app-settings` | `src/engine/contracts/types/app-settings.ts` | `AppSettings` | `src/runtime/storage/collections/app-settings.ts` |
| `characters` | `src/engine/contracts/types/character.ts` | `CharacterRecord` | `src/runtime/storage/collections/character-storage.ts` |
| `roleplay-threads` | `src/engine/contracts/types/roleplay.ts` | `RoleplayThreadRecord` | `src/runtime/storage/collections/roleplay-storage.ts` |
| `roleplay-entries` | `src/engine/contracts/types/roleplay.ts` | `RoleplayEntry` | `src/runtime/storage/collections/roleplay-entry-storage.ts` |
| `lorebooks` | `src/engine/contracts/types/lorebook.ts` | `LorebookRecord` | `src/runtime/storage/collections/lorebook-storage.ts` |
| `messenger-threads` | `src/engine/contracts/types/messenger.ts` | `MessengerThreadRecord` | `src/runtime/storage/collections/messenger-storage.ts` |
| `messenger-messages` | `src/engine/contracts/types/messenger.ts` | `MessengerMessage` | `src/runtime/storage/collections/messenger-message-storage.ts` |
| `personas` | `src/engine/contracts/types/persona.ts` | `PersonaRecord` | `src/runtime/storage/collections/persona-storage.ts` |
| `provider-connections` | `src/engine/contracts/types/provider-connection.ts` | `ProviderConnectionRecord` | `src/runtime/storage/collections/provider-connection-storage.ts` |
| `ripple-states` | `src/engine/contracts/types/ripples.ts` | `RippleState` | `src/runtime/storage/collections/ripple-state-storage.ts` |

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

Lorebooks currently use `schemaVersion: 2`. New lorebooks default activation to
`scanDepth: 2`, `includeNames: true`, `caseSensitiveKeys: false`,
`matchWholeWords: true`, `recursiveScan: false`, `maxRecursionSteps: 0`,
`budgetTokens: null`, and `budgetPercent: 25`.

Lore entries inside a lorebook also use `schemaVersion: 2`. New entries default
to `enabled: true`, `strategy: "constant"`, `probability: 100`,
`insertionPosition: "after-character"`, `insertionOrder: 100`, and null keys,
selective logic, inclusion group, depth, role, recursion, timing, triggers,
character filter, and match-source blocks.

The lorebook collection adapter normalizes v2 values, filters malformed v2
entries without dropping valid sibling entries, requires non-negative integer
activation depths, clamps percentages to 0-100, and intentionally rejects pre-v2
lorebook or entry records instead of migrating them. Pre-v2 lorebook records
were development-only; revisit this before DeKoi has supported user data that
requires compatibility. Current generation applies lore activation before
building prompt context: enabled constant entries with non-empty bodies
activate automatically, while selective entries activate when any non-empty
plaintext primary key matches the last `scanDepth` transcript items, optionally
including speaker names. Matching respects `caseSensitiveKeys` and
`matchWholeWords`; regex-like `/.../` keys are deferred as non-matches.
Activated entries are sorted by descending `insertionOrder`, with selected
lorebook order and original entry order as stable tiebreakers. Messenger and
Roleplay prompt assembly places `before-character` entries before persona and
character context, `after-character` entries after character context, and
`at-depth` entries into transcript messages by depth from the newest transcript
item. At-depth role defaults to `system`; Anthropic and Google provider
connections convert at-depth system lore to `user` because those providers
hoist system messages. Lorebook budgets apply per lorebook, using
`budgetTokens` first or `budgetPercent` against provider `maxContext` when
known. Percent budgets are left unapplied when context size is unknown. Budget
trimming spends budget on constant entries before selective entries, then uses
descending `insertionOrder` plus the same stable tiebreakers within each
strategy group. Estimates use roughly characters divided by 4 because DeKoi
has no tokenizer dependency. Roleplay lorebook summaries count against budgets
and are emitted at most once per generation request. Probability,
secondary-key logic, recursion, triggers, and filters remain normalized storage
fields but are not applied to prompt assembly yet.

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
- sibling `.json.bak`, `.json.tmp`, and `.json.pre-repair` artifact state
- whether a backup is restorable
- whether the collection state is repairable

The app stores metadata from the last loaded snapshot, completed import, or
successful collection write as a staleness baseline. Pond Care > Deep Water can
check the current desktop metadata and report when collection files changed
outside DeKoi, but the app does not hot-load or merge those files. Partial
desktop metadata checks keep per-entity details for healthy collections and
report which entity failed inspection, but they are not accepted as a complete
stale-check baseline. Remote runtime targets do not need to provide comparable
metadata; stale checks report metadata as unavailable there. Reload is an
explicit user action that reloads records from the active runtime target. Reload
is blocked while collection saves or imports are pending or active. If only
local unsaved changes remain, reload asks for confirmation before replacing the
in-memory snapshot.

When checking all desktop collections, metadata includes known DeKoi collection
entities and any extra collection-like files discovered in the desktop
collections directory. Unknown future entities are surfaced in Pond Care as
unrepairable by the current app version instead of being silently hidden.

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
invalid JSON, non-array JSON, and missing files with `.json.bak`, `.json.tmp`,
or `.json.pre-repair` siblings are recoverable storage errors, not empty
collections.

When a desktop collection file is malformed, the desktop runtime reports the
entity name, path category, whether `.json.bak`, `.json.tmp`, or
`.json.pre-repair` siblings exist, and that writes are blocked. Normal autosave
must not overwrite that collection until an explicit repair/import path repairs
or replaces the corrupt file.

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

The backup is a recovery aid, not an automatic overwrite path. Pond Care exposes
an explicit desktop-only repair workflow for one malformed collection at a time.
Repair commands require `confirm: true`, accept only supported collection
entities, and support two strategies:

- `restore-backup`: validate the sibling `.json.bak` contains a JSON array,
  preserve the current malformed file as `<entity>.json.pre-repair` when that
  sidecar does not already exist, then install the backup records through the
  same temp-file atomic write path.
- `replace-empty`: replace the malformed file with an empty JSON array through
  the same temp-file atomic write path. This is rejected when a restorable
  `.json.bak` backup is available. Otherwise, preserve the malformed current
  file as `<entity>.json.pre-repair` when that sidecar does not already exist
  and use it as the rollback source during installation.

Repair results return the repaired collection metadata. Existing `.json.bak`
backups and existing `.json.pre-repair` sidecars are preserved. When a
`.json.pre-repair` sidecar exists beside a valid repaired collection, Pond Care
shows a separate Finish repair action. That command requires `confirm: true`,
verifies the live collection is usable, then removes only the pre-repair sidecar.
Normal autosave still uses `storage_replace` and never invokes repair or finish
repair automatically.

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

Messenger and Roleplay settings may surface stale relationship IDs from
hand-edited, partially imported, or older data and call the matching mode owner
actions to clear only the missing thread references.

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

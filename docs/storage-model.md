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

`storage_replace` is the primary DeKoi save path. Partial mutation commands stay
in the runtime contract for future targeted adapters, but they must not upsert,
silently replace records, synthesize IDs, or fabricate malformed durable records.
`storage_create` rejects existing IDs, `storage_update` and `storage_delete`
reject missing IDs, and create/update results must still satisfy the durable
record rules below, including `schemaVersion >= 1` for non-settings records.
`storage_update` merges into the existing record, rejects mismatched `patch.id`
values, and stamps `updatedAt` for non-settings records.

If DeKoi later uses SQLite or another database, that database is an
implementation detail behind the same DeKoi record contracts. It should not
leak table-driven names into UI, engine records, provider requests, or import
adapters.

## Current Collections

| Entity                  | Native owner                                        | Record                     | Runtime adapter                                                   |
| ----------------------- | --------------------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `app-settings`          | `src/engine/contracts/types/app-settings.ts`        | `AppSettings`              | `src/runtime/storage/collections/app-settings.ts`                 |
| `characters`            | `src/engine/contracts/types/character.ts`           | `CharacterRecord`          | `src/runtime/storage/collections/character-storage.ts`            |
| `roleplay-threads`      | `src/engine/contracts/types/roleplay.ts`            | `RoleplayThreadRecord`     | `src/runtime/storage/collections/roleplay-storage.ts`             |
| `roleplay-entries`      | `src/engine/contracts/types/roleplay.ts`            | `RoleplayEntry`            | `src/runtime/storage/collections/roleplay-entry-storage.ts`       |
| `lorebooks`             | `src/engine/contracts/types/lorebook.ts`            | `LorebookRecord`           | `src/runtime/storage/collections/lorebook-storage.ts`             |
| `prompt-presets`        | `src/engine/contracts/types/prompt-presets.ts`      | `PromptPresetRecord`       | `src/runtime/storage/collections/prompt-preset-storage.ts`        |
| `lore-runtime-states`   | `src/engine/contracts/types/lore-runtime-state.ts`  | `LoreRuntimeState`         | `src/runtime/storage/collections/lore-runtime-state-storage.ts`   |
| `macro-variable-states` | `src/engine/contracts/types/macro-variables.ts`     | `MacroVariableScope`       | `src/runtime/storage/collections/macro-variable-state-storage.ts` |
| `messenger-threads`     | `src/engine/contracts/types/messenger.ts`           | `MessengerThreadRecord`    | `src/runtime/storage/collections/messenger-storage.ts`            |
| `messenger-messages`    | `src/engine/contracts/types/messenger.ts`           | `MessengerMessage`         | `src/runtime/storage/collections/messenger-message-storage.ts`    |
| `personas`              | `src/engine/contracts/types/persona.ts`             | `PersonaRecord`            | `src/runtime/storage/collections/persona-storage.ts`              |
| `provider-connections`  | `src/engine/contracts/types/provider-connection.ts` | `ProviderConnectionRecord` | `src/runtime/storage/collections/provider-connection-storage.ts`  |
| `ripple-states`         | `src/engine/contracts/types/ripples.ts`             | `RippleState`              | `src/runtime/storage/collections/ripple-state-storage.ts`         |

The additive `ModeThread` contract is not a current durable record and has no
collection or runtime adapter. Messenger and Roleplay storage continues to use
the concrete thread/transcript rows above until a later atomic cutover; this
foundation does not migrate or invalidate current local data.

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

App settings normalize `globalLorebookIds` as trimmed unique lorebook IDs and
`loreInsertionStrategy` as one of `sorted-evenly`, `character-first`, or
`global-first`. Missing or invalid values fall back to no global lorebooks and
`sorted-evenly`. `defaultPromptPresetId` normalizes to a trimmed ID or `null`;
snapshot and bundle relationship repair then ensure it identifies a usable
preset.

Persona records normalize `lorebookIds` as trimmed unique lorebook IDs, matching
character lorebook bindings.

Lorebooks currently use `schemaVersion: 2`. New lorebooks default activation to
`scanDepth: 2`, `includeNames: true`, `caseSensitiveKeys: false`,
`matchWholeWords: true`, `recursiveScan: false`, `maxRecursionSteps: 0`,
`useGroupScoring: false`, `budgetTokens: null`, and `budgetPercent: 25`.

Lore entries inside a lorebook also use `schemaVersion: 2`. New entries default
to `enabled: true`, `strategy: "constant"`, `probability: 100`,
`groupWeight: 100`, `prioritizeInclusion: false`,
`insertionPosition: "after-character"`, `insertionOrder: 100`, and null keys,
selective logic, inclusion group, depth, role, recursion, timing, triggers,
character filter, and match-source blocks. Primary and secondary key arrays are
trimmed, empty entries are removed, and duplicate keys are discarded in
first-seen order.

The lorebook collection adapter normalizes v2 values, filters malformed v2
entries without dropping valid sibling entries, requires non-negative integer
activation depths, clamps percentages to 0-100, normalizes group weights to
non-negative finite numbers, and intentionally rejects pre-v2 lorebook or entry
records instead of migrating them. Pre-v2 lorebook records were
development-only; revisit this before DeKoi has supported user data that
requires compatibility.

Prompt presets use `schemaVersion: 1` and require a non-empty local ID and title.
Prompt text and the rest of the recipe are optional: omitted or null shared
prompt text normalizes to `systemPrompt: ""`; nullable text and metadata
normalize to `null`; parameters normalize to an object or `null`; and omitted
ordering fields, `sections`, `groups`, `choiceBlocks`, variable groups, static
`variableValues`, and `defaultChoices` normalize to stable empty arrays or maps.
An explicitly non-string shared prompt or present non-array `sections`, `groups`,
or `choiceBlocks` rejects the record instead of silently erasing malformed data.
Native preset records do not store a default flag;
`AppSettings.defaultPromptPresetId` is the sole native default authority. The
`parameters` object preserves normalized prompt-preset controls such as
`temperature`, `topP`, `maxTokens`, `topK`, `minP`, `maxContext`, penalties,
service/model effort strings, stop sequences, custom parameters, and
provider-shaping booleans. Current provider requests consume the `sampling`
projection
(`temperature`, `topP`, and `maxTokens`) from the selected preset. Invalid
parameter and sampling fields are dropped during load. Preset `maxTokens` can
override request parameters, but the final generation request is capped by the
selected provider connection's positive `maxOutput` when one is configured. The
bundled starter preset is ordinary user-editable data except while it is the
default. Any successful load with no usable prompt presets restores the exact
bundled starter in memory. A genuinely empty collection is queued for the normal
save path; if unreadable records were dropped, automatic saving remains blocked
until explicit storage repair preserves or resolves that evidence. The starter
initialization marker is recorded in app settings, but it does not suppress
empty-collection recovery. Ordinary deletion cannot empty the collection
because the default and last preset cannot be deleted.

### Development reset for a changed starter preset

The bundled starter is ordinary stored data, so an existing development store
does not automatically receive a newly changed starter. To inspect the current
Universal V2 starter:

- **Desktop/local app:** stop DeKoi, remove the local
  `<app-data>/collections/prompt-presets.json` collection file, then restart
  DeKoi. A missing desktop prompt-preset collection is seeded on startup. This
  intentionally deletes the local development prompt presets; preserve or
  export them first if they matter.
- **Remote runtime:** use the runtime/deployment's data-management procedure to
  replace the `prompt-presets` collection with an empty array, then restart
  DeKoi. The clean empty collection is repaired with the starter.

These resets intentionally destroy local prompt presets. On the next load,
`defaultPromptPresetId` and dangling active thread preset references are repaired
to the restored starter.

Choice blocks carry stable block IDs, unique variable names, optional questions,
options with stable IDs and optional descriptions, reusable defaults,
multi-select separators, display and sort modes, optional ordering/timestamp
metadata and preset linkage. Choice blocks are always visible and independent.
Blank optional question,
description, and separator text is omitted when the catalog saves. The catalog
uses `variableOrder` for displayed choice order while preserving compatible
non-choice slots in their existing positions as choices move, appear, or are
removed.
Prompt preset `defaultChoices` remain compatible package data keyed by variable
name and may use option values or IDs. Native threads store
`presetChoiceSelectionsByPresetId`, a map from preset ID to a deliberately
narrower confirmed-choice map keyed by stable choice-block ID. Values are stable
option-ID objects such as
`{ "kind": "option", "optionId": "tone-soft" }`, or ordered arrays of those
objects for multi-select blocks. Duplicate IDs are removed in first-seen order.
Switching or clearing the active preset retains each preset's independent
history. On load, malformed histories are normalized and the removed legacy
`presetChoiceSelections` field is migrated into the active preset's history when
that history is absent. For a history whose preset still exists, an invalid
confirmed choice is repaired to the preset default, then the block default or
first valid option; a block with no prior answer is not materialized. Unknown
blocks are removed, histories for missing presets are retained, and affected
thread collections are queued for rewrite. DeKoi does not create aliases or
tombstones for renamed or removed IDs.
At runtime, the presence of the active preset ID as a history key records
confirmation. First use of a variable-bearing preset does not write that key
until the user confirms choices or materialized defaults, so generation remains
blocked and cancel can preserve the previous preset. A choice-free preset writes
an empty history entry immediately. If a live preset edit makes an existing
history incomplete or invalid, the Messenger or Roleplay mode owner
materializes valid defaults, updates only the latest matching thread record,
persists the repair once, and surfaces a review notice.
Messenger ordinary conversation settings select a prompt preset and its
preset-authored Variables; they do not own an arbitrary prompt or model-
parameter override. Generation uses the selected preset's `messengerPrompt`,
then shared `systemPrompt`, and falls back to the built-in
`DEFAULT_MESSENGER_SYSTEM_PROMPT` when no usable selected preset prompt exists.
That fallback is assembled for the request and is not persisted into the blank
preset.
Messenger does not consume prompt preset sections for prompt assembly. Old
development override keys are ignored and dropped by normalization; there is no
migration or conversion promise for them.
In Roleplay, a selected prompt preset can replace the system prelude, sampling,
and narration or other-character output behavior. When the preset has usable
sections, Roleplay assembles provider messages from enabled sections and
adjacent enabled groups instead of the fallback system prelude. Marker sections
expand Roleplay context for `chat_summary`, `lorebook`, `world_info_before`,
`world_info_after`, `persona`, `character`, `dialogue_examples`, and
`chat_history`; sectioned presets include transcript history only through an
enabled `chat_history` marker. Depth sections insert around the `chat_history`
marker when present, or around the sectioned prompt message stream by depth from
the newest item. With no usable section messages, Roleplay falls back to the
selected shared system prompt and then to the built-in Roleplay prelude, without
automatically replaying transcript history. DeKoi still appends a Roleplay
post-history contract that keeps the target companion primary, protects the
user's dialogue and agency, and leaves narration and other-character output
behavior to the selected preset. Only no-preset, single-character Roleplay uses
the Roleplay-owned one-character output contract.
Messenger and Roleplay threads resolve the active preset's entry in
`presetChoiceSelectionsByPresetId`. Choice selections resolve with preset
`variableValues`, defaults, and multi-select separators into
request-local macro variables before prompt assembly.
Every normalized choice block resolves independently. Choice blocks never choose
random options; use random variable macros when prompt randomness is required.
Changing or clearing a thread's selected prompt preset preserves its stored
choice histories; selecting a preset again restores its confirmed choices.

Current generation builds a generation-owned macro context, including the
request-local variable map, at the mode boundary. It resolves current built-in
macros in activation inputs through scratch contexts so variable mutations do
not commit while scanning, then applies lore activation before building final
prompt messages. Messenger and Roleplay resolve lorebook sources from
chat/thread selections, the active persona, selected characters, and global app
settings, then scan each lorebook at most once. If the same lorebook appears in
more than one bucket, the first bucket wins in deterministic order: chat,
persona, character, then global. Enabled constant entries with non-empty source
bodies activate automatically unless blocked by timing delay or delayed until
recursion, while selective entries activate when any non-empty primary key
matches the last `scanDepth` transcript items, optionally including speaker
names. Entries can also opt into additional match sources from selected
companion `description`, `personality`, `scenario`, and `characterNote` fields
and the active persona `description`; these sources are not scanned by default.
Those companion/persona match-source fields are macro-resolved before
activation. The same `includeNames` setting controls whether macro-resolved
companion/persona display names and nicknames are included in those additional
source blobs. Plaintext matching respects `caseSensitiveKeys` and
`matchWholeWords`; `/pattern/flags` keys compile as regex, bypass whole-word
wrapping, and fall back to plaintext with a warning when invalid or unsafe.
Timing delay blocks direct and recursive activation until the thread's
non-empty transcript count is at least the entry's `delay`; cooldown blocks
reactivation while its timer remains. Sticky timers activate entries before
normal matching while `stickyRemaining` is positive.
When `recursiveScan` is enabled and a direct entry activates, DeKoi appends
macro-resolved activated entry bodies that do not set `preventFurther` to the
scan buffer and repeatedly scans remaining eligible entries. Random and roll
macro spans are stripped from those recursion bodies so hidden sampled text
cannot unlock further entries. `nonRecursable` entries can still activate
directly but never from recursion.
`delayUntilRecursion` blocks direct activation; `recursionLevel: 0` opens on the
first recursion pass, and higher levels open after lower-level recursion
stabilizes. `maxRecursionSteps` caps recursion passes; `0` means no configured
cap, but DeKoi stops at 64 passes and surfaces a warning. Each entry activates
at most once per generation request.
After direct and recursive activation, DeKoi resolves comma-separated
`inclusionGroup` values, keeping one active entry per overlapping group. Active
entries are sorted by descending `insertionOrder` before group resolution, so
overlapping groups are discovered in prompt-priority order. A group with any
`prioritizeInclusion` entry switches the whole group to highest-`insertionOrder`
resolution; the flagged entry does not automatically win. When
`useGroupScoring` is enabled, groups use highest unique matched primary-key
count; otherwise groups use weighted random selection by `groupWeight`. If all
active candidates in a weighted group have zero weight, the first
prompt-priority candidate wins. Sticky activations bypass inclusion-group
suppression and per-entry `probability`; other surviving entries pass through
the probability gate. The default `sorted-evenly` insertion strategy sorts
activated entries by descending `insertionOrder`, with resolved lorebook source
order and original entry order as stable tiebreakers. `character-first` ranks
character-sourced lore before other source buckets, and `global-first` ranks
global lore before other source buckets; both strategies keep the same
`insertionOrder` and stable tiebreakers within each rank.
Messenger and Roleplay prompt assembly places `before-character` entries before
persona and character context, `after-character` entries after character
context, and `at-depth` entries into transcript messages by depth from the
newest transcript item. Kept lore summaries and bodies commit variable
mutations only when that prompt-position text is formatted; dropped,
macro-empty, unselected, or preview-only text does not commit variables or
sample final random output. At-depth role defaults to `system`; Anthropic and
Google provider connections convert at-depth system lore, and later Roleplay
sectioned-preset system messages, to `user` because those providers hoist
system messages. Lorebook budgets apply per lorebook, using
`budgetTokens` first or `budgetPercent` against provider `maxContext` when
known. Percent budgets are left unapplied when context size is unknown. Budget
trimming spends budget on direct activations before recursive activations, then
on constant entries before selective entries within each direct/recursive group,
then uses descending `insertionOrder` plus the same stable tiebreakers within
each priority group. Kept entries are re-sorted into prompt order afterward.
Estimates use macro-resolved lore summaries and bodies at roughly characters
divided by 4 because DeKoi has no tokenizer dependency. Macro-aware budget
previews use resolved random option lengths, conservative bare-random estimates,
and the variable state at that prompt position; previews are recomputed after
earlier prompt-order variable commits. Timers are started or preserved only for
lore entries that survive final formatting and budget trimming; when an active
sticky entry is trimmed, DeKoi clears the sticky timer while preserving any
remaining cooldown. Macro-empty formatted bodies are omitted and do not start
timers. Roleplay lorebook summaries count against budgets and are emitted at
most once per generation request. Optional secondary keys and `selectiveLogic`
are applied against the same per-entry scan buffer during activation. Sticky,
cooldown, and delay timing fields are normalized storage fields; prompt assembly
applies them through per-thread `lore-runtime-states`, which record active entry
timers by `(lorebookId, entryId)` and advance once per generation from the
current non-empty transcript count. Macro-activated lore runtime updates are
finalized only after every prompt-position lore format pass settles, so
budget-dropped and macro-empty entries can clear timers before the updated state
is persisted. Lore runtime states are cleared when an owning Messenger or
Roleplay thread is deleted or its transcript is cleared. Timer entries also
reset on the next activation pass when their lore entry's `updatedAt` no longer
matches, so editing an entry starts its sticky/cooldown state fresh. Triggers
and character filters remain normalized storage fields but are not applied to
prompt assembly yet.

Dynamic macro variables persist in `macro-variable-states`. Global state uses
`ownerKind: "global"` with `ownerId: "global"`; Messenger and Roleplay states
use their thread ID. Generation starts with global variables, overlays the
thread variables, then overlays resolved prompt-preset static and choice
variables for the active request. It resolves macros, then persists only the
committed mutation log after generation succeeds. Mutated keys target the scope
that supplied them at generation start: thread keys stay thread-scoped, keys
that belonged only to global state stay global, and new keys are saved to the
thread scope. Prompt-preset static and choice variables are request inputs from
the preset and the active `presetChoiceSelectionsByPresetId` history; they are
resolved once before
prompt assembly and are not persisted in this collection. Mutations targeting
those request-local names can affect later prompt text in the same request, but
they are skipped when `macro-variable-states` are committed.

Generic JSON reader helpers for storage/import normalization live in
`src/runtime/storage/storage-json.ts`. Product-specific normalization stays in the
owning runtime adapter for each collection. Native collection adapters read
DeKoi field names only; old aliases such as `name`, `shortName`, `summary`,
`url`, legacy provider labels, and removed provider kinds belong in the one-way
legacy import adapter instead of durable load/save paths.
Native provider connection rows and DeKoi storage bundles must use
`kind: "provider"`. The native load path accepts the old
provider-connection kind `"remote-runtime"` only as a narrow boundary migration:
valid rows are normalized to `kind: "provider"` with their IDs preserved, so
existing thread references still resolve. The old row must still have a
recognized provider plus non-empty native label, base URL, and model fields.
Removed provider lanes such as `mock`, `local`, malformed `remote-runtime`, or
missing `kind` still reject on the native load path. Wider alias and shape
cleanup belongs in the one-way legacy import adapter.

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
The shared repository module also owns storage result aggregation and normalizer
result wrapping, including dropped-record counts, so snapshot and import/export
orchestration can combine adapter outcomes without depending on a concrete host
implementation.
Repository `seedRecords` are a load-failure fallback only: when desktop or
remote storage successfully returns an empty collection, the collection stays
empty instead of being replaced with seed records.

App-wide save orchestration in `src/app/use-app-storage-sync.ts` tracks dirty
collections instead of fanning every save out to every collection. It debounces
rapid state changes, schedules writes during idle time with a one-second deadline
so a continuously busy page cannot postpone them indefinitely, sends one
`storage_replace` per dirty collection, serializes collection writes, and stops
the save batch on the first failed collection write.
The same app-sync owner exposes an explicit flush barrier for backup, export,
import, reload, shutdown, and manual workflows. A flush cancels queued dispatch,
records the current collection signatures, writes dirty saveable collections,
waits for active and pending saves to settle, and reports a blocked result
instead of pretending success when storage is not ready, an import is active,
the storage target changes, unreadable dropped records block replacement saves,
or records change while the flush is running.

Desktop collection files expose explicit per-collection metadata:

- entity
- file existence
- byte length
- updated-at milliseconds
- content hash
- sibling `.json.bak`, recognized write-temp, and `.json.pre-repair` artifact state
- whether a backup is restorable
- whether the collection state is repairable

The app stores metadata from the last loaded snapshot, completed import, or
successful collection write as a staleness baseline. Pond Care > Data & Backup can
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
invalid JSON, non-array JSON, and missing files with `.json.bak`, legacy
`.json.tmp`, unique `.json.write-*.tmp`, or `.json.pre-repair` siblings are
recoverable storage errors, not empty collections.

When a desktop collection file is malformed, the desktop runtime reports the
entity name, path category, whether backup, recognized write-temp, or
`.json.pre-repair` siblings exist, and that writes are blocked. Normal autosave
must not overwrite that collection until an explicit repair/import path repairs
or replaces the corrupt file.

### Per-Collection Load Errors

App-wide snapshot loading preserves the message from every collection whose
load result is an error. `AppStorageSnapshot.loadErrorMessageByCollection` keys
those messages by the canonical `AppStorageCollectionKey`; the existing merged
`storageResult` remains the compatibility aggregate and reports only the first
error.

Pond Care lists every structured error with the collection's readable label for
both desktop and remote-runtime storage. These alerts do not depend on the
desktop-only repair metadata path. A failed manual reload keeps the last good
in-memory records while publishing the current reload's collection errors. The
alerts are scoped to the active storage-target generation: a permitted reload
or target load clears them when it begins, the current load publishes its own
results, and stale asynchronous completions cannot clear or replace them. A
healthy retry and a current-generation unexpected load exception leave no stale
per-collection alerts.

### Per-Record Load Drops

A readable collection file or remote `storage_list` response may still contain
individual records the runtime adapter cannot normalize (a hand-edited entry, a
record written by a newer DeKoi after a downgrade, or a record created through a
raw storage command). Unlike a corrupt file, the collection loads; the
unreadable records are skipped.

Load normalization counts skipped collection records per collection and can also
count legacy embedded transcript items rejected while their parent thread record
loads. The count is surfaced through the storage snapshot (`droppedRecordCount`
on each collection snapshot, aggregated as `droppedRecordCountByCollection` on
the app storage snapshot). Pond Care derives one dropped-records warning from
those structured counts whenever any collection had drops on the most recent
load; normal storage status messages stay plain and do not duplicate the
warning.

Because `storage_replace` writes the whole collection, editing any record in a
collection that had drops would erase the skipped records from disk on the next
save (only the single-generation `.json.bak` retains them for desktop JSON).
DeKoi blocks saves for affected collections until a reload or explicit
import/restore replaces them with data that loads without drops. For split
transcript storage, a drop in either the thread collection or its transcript item
collection blocks saves for both collections in that Messenger or Roleplay pair.
Restore from a backup bundle before editing a collection that reported drops.
Legacy transcript auto-migration treats each Messenger or Roleplay thread and
transcript split as one migration group; if either collection in that group had
drops, DeKoi skips automatic migration for the group and leaves the Pond Care
warning as the recovery signal.

Desktop collection JSON writes use an operation-owned sibling temp file and a
`.json.bak` sibling:

- atomically allocate a unique `<entity>.json.write-*.tmp` without truncating an
  existing sibling
- write and sync the temp file
- preserve the readable current file as `<entity>.json.bak`
- atomically install only that operation's temp file without overwriting a
  destination that appeared concurrently, using native no-replace rename with
  an atomic hard-link fallback
- leave the destination untouched on install failure and keep recovery artifacts
- best-effort sync the final file and parent directory

DeKoi storage bundle files use the same temp-file write and sync path, but they
do not create `.json.bak` siblings. Replacing an existing bundle or standalone
preset export first creates a unique transient rollback sibling. Failed install
leaves the destination untouched and retains that rollback; successful install
reports the destination as committed and identifies any rollback that cleanup
could not remove.

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
  so failed installation retains an explicit recovery source.

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
instead of relying on React state changes and the autosave effect. When prompt
presets and app settings are both replaced, `prompt-presets` is written before
app settings (including its default preset reference and starter marker), and
replacement stops on the first failed
collection write.
The preview includes a fingerprint of the normalized bundle content. The Care UI
checks the preview fingerprint again at commit time so a stale preview cannot
commit different normalized data than the user reviewed.

Before committing an import, the Care UI creates a pre-import DeKoi bundle
backup. In the desktop app, this uses the awaitable desktop save dialog and the
import is not started if the save is cancelled or fails. In a browser-only
session, DeKoi can only request a JSON download, so the UI describes that backup
as browser-saved instead of verified.

If a collection replace fails, the import result reports the failed collection,
records how many collections were replaced before the failure, marks partial
commits as requiring a reload, reloads persisted storage so React state reflects
the partial durable state, and keeps an in-session pre-import restore available
while the storage target remains unchanged. Restoring the in-session backup uses
the same explicit replacement path as import commit and is blocked while another
import, restore, active save, queued save, pending save, or unsaved signature is
present. Legacy converted imports add native catalog, provider, Messenger, and
macro variable scope records to the current snapshot and use the same explicit
commit path instead of relying on autosave.
Imported thread-scoped macro variable scopes are appended with their converted
Messenger threads. Imported global macro variables are merged into the current
global scope when one exists; same-name imported globals take precedence, and the
preview warns before commit.
Because that path commits a complete current snapshot, pending changes in other
collections are persisted along with the converted records.

The desktop host keeps a Rust allowlist for local file access:

- `src-tauri/src/storage.rs`

Run this check after any collection change:

```sh
pnpm check:storage-contracts
```

The check fails if the TypeScript registry, TypeScript semantic alias map, Rust
allowlist, documented collection table, or approved Universal V2 starter
package bytes drift. It also verifies each documented native owner file exists
and names the documented record type, and that each documented runtime adapter
uses the expected repository entity alias.

## Record Rules

- Every durable product record uses a DeKoi-owned noun.
- Every durable product record carries `id`, `schemaVersion`, `createdAt`, and
  `updatedAt` unless the record is explicitly documented as singleton settings.
- Each collection has one native owner. UI code may request changes, but it does
  not define the durable shape.
- Runtime adapters may normalize unknown JSON into native records, but they do
  not invent product meaning.
- Native collection adapters do not translate legacy catalog or provider aliases
  while loading DeKoi collections or native bundles.
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

| From                    | Field                                          | Points to                                                      | Cleanup expectation                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messenger-threads`     | `characterIds[]`                               | `characters.id`                                                | Deleted characters are removed from thread participants.                                                                                                                                                             |
| `messenger-threads`     | `activePersonaId`                              | `personas.id`                                                  | Deleted personas clear the active persona.                                                                                                                                                                           |
| `messenger-threads`     | `lorebookIds[]`                                | `lorebooks.id`                                                 | Deleted lorebooks are removed from thread context.                                                                                                                                                                   |
| `messenger-threads`     | `presetId`, `presetChoiceSelectionsByPresetId` | `prompt-presets.id`                                            | New threads select the app default. Deleting a non-default preset reassigns active threads to the default while retaining per-preset choice histories. Messenger threads have no conversation-owned prompt override. |
| `messenger-threads`     | `providerConnectionId`                         | `provider-connections.id`                                      | Deleted connections clear the selected connection.                                                                                                                                                                   |
| `messenger-messages`    | `threadId`                                     | `messenger-threads.id`                                         | Deleting a Messenger thread removes its messages from the projected message collection.                                                                                                                              |
| `roleplay-threads`      | `characterIds[]`                               | `characters.id`                                                | Deleted characters are removed from scene participants.                                                                                                                                                              |
| `roleplay-threads`      | `activePersonaId`                              | `personas.id`                                                  | Deleted personas clear the active persona.                                                                                                                                                                           |
| `roleplay-threads`      | `lorebookIds[]`                                | `lorebooks.id`                                                 | Deleted lorebooks are removed from scene context.                                                                                                                                                                    |
| `roleplay-threads`      | `presetId`, `presetChoiceSelectionsByPresetId` | `prompt-presets.id`                                            | New threads select the app default. Deleting a non-default preset reassigns active threads to the default while retaining per-preset choice histories.                                                               |
| `roleplay-threads`      | `providerConnectionId`                         | `provider-connections.id`                                      | Deleted connections clear the selected connection.                                                                                                                                                                   |
| `roleplay-entries`      | `threadId`                                     | `roleplay-threads.id`                                          | Deleting a Roleplay thread removes its entries from the projected entry collection.                                                                                                                                  |
| `characters`            | `lorebookIds[]`                                | `lorebooks.id`                                                 | Deleted lorebooks are removed from character context.                                                                                                                                                                |
| `personas`              | `lorebookIds[]`                                | `lorebooks.id`                                                 | Deleted lorebooks are removed from persona context.                                                                                                                                                                  |
| `app-settings`          | `globalLorebookIds[]`                          | `lorebooks.id`                                                 | Deleted lorebooks are removed from global generation context.                                                                                                                                                        |
| `app-settings`          | `defaultPromptPresetId`                        | `prompt-presets.id`                                            | The sole native default authority. Missing references repair to the first usable preset; the default and last preset cannot be deleted.                                                                              |
| `lore-runtime-states`   | `ownerId`                                      | `messenger-threads.id` or `roleplay-threads.id`                | Deleting a thread removes its lore timers; orphaned states are skipped on bundle import.                                                                                                                             |
| `macro-variable-states` | `ownerId`                                      | `messenger-threads.id`, `roleplay-threads.id`, or global scope | Deleting or clearing a thread removes its thread-scoped macro variables; orphaned thread scopes are skipped on bundle import.                                                                                        |
| `ripple-states`         | `ownerId`                                      | `messenger-threads.id` or `roleplay-threads.id`                | Orphaned ripple states are skipped on bundle import.                                                                                                                                                                 |

Default changes and non-default deletion use a relationship transaction. It
saves only affected collections in referentially safe order before publishing
React state. A failed or blocked transaction reports failure, reloads persisted
state when safe, and preserves newer or independently dirty in-memory state.

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
- Include `lore-runtime-states` in native bundles, import missing older bundle
  fields as empty, and skip runtime states whose owner thread is not imported.
- Include `macro-variable-states` in native bundles, import missing older bundle
  fields as empty, and skip thread-scoped states whose owner thread is not
  imported. Global macro variable state is not owner-filtered.
- Include `prompt-presets` and `appSettings.defaultPromptPresetId` in native
  bundles. Exported records stay DeKoi-native with their IDs; bundle
  import may also normalize packaged prompt preset envelopes with
  `data.preset`, `sections`, `groups`, and `choiceBlocks` into native records.
  Packaged `name`/`description` become `title`/`summary`, `conversationPrompt`
  becomes `messengerPrompt`, and sections remain independent from the shared
  `systemPrompt`; an omitted shared prompt normalizes to `""`. Packaged `author`
  and `folderId` metadata are preserved when present; packaged `isDefault` is
  not native authority and is discarded.
  The package recipe arrays may be omitted and then normalize to empty arrays,
  but a present top-level `sections`, `groups`, or `choiceBlocks` value must be
  an actual JSON array. Nested choice `options` may retain the supported
  JSON-string compatibility form. Malformed prompt values and present non-array
  recipe collections reject the package.
  An empty or unusable imported preset collection is repaired with the bundled
  starter. A missing default is repaired to the first usable imported preset,
  and dangling active thread references are reassigned to it without erasing
  per-preset histories. Source envelope fields do not survive on the native
  record.
- Keep standalone prompt preset files separate from full storage bundles. The
  Presets catalog exports one saved record as a `dekoi_preset` version 1 package
  named from its title with a normal `.json` extension. Standalone import is
  content-driven: supported `dekoi_preset` and compatible `marinara_preset`
  version 1 envelopes may use `.json` or `.marinara.json` filenames. A valid
  import keeps supported parameters, sections, groups, choices, variables,
  ordering, and metadata, then creates one fresh native preset ID and rewrites
  nested preset ownership to that ID. It never changes the app default. Parse
  or validation failure does not add a catalog record. With configured storage,
  import success is reported only after the prompt-preset collection flushes; a
  failed prompt-preset save removes the new session record and flushes that
  rollback. When no storage target exists, browser import remains available as
  explicit session-only state and the catalog warns that it will not survive
  reload.
- Normalize malformed or stale per-preset thread choice histories during
  preview. Preview warnings count those repaired threads separately from threads
  whose missing active preset reference was reassigned to the imported default.
- Include persona lorebook bindings and global lore settings in native bundle
  import/export through the normalized `personas` and `app-settings` records.
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
The current legacy import adapter can convert legacy companion, persona,
provider-connection, Messenger thread, and macro variable records. Legacy
`globalVariables` become a global `MacroVariableScope`; Messenger thread
`variables` become thread-scoped `MacroVariableScope` records. Variable names are
trimmed, string, number, and boolean values are converted to strings, null
values become empty strings, and unsupported values or blank names are dropped.
Legacy preview counts report both macro variable scopes and individual macro
variables.
Before append, imported IDs are remapped and imported thread provider references
are cleared when the legacy provider record was not converted. Thread-scoped
macro variable scopes are paired to imported Messenger threads by source
position during preview and preparation, so duplicate legacy thread IDs and
asymmetric variable presence keep the correct imported owner. Imported global
variables are merged with current global variables at commit; imported same-name
globals overwrite current values and Pond Care shows a warning before commit.

Future storage direction lives in [Storage Roadmap](./storage-roadmap.md).

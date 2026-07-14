# Domain Model

This document is DeKoi's plain-language product vocabulary and product-record
glossary. Exact TypeScript contracts now live under
`src/engine/contracts/types`, and durable collection rules live in
[docs/storage-model.md](./docs/storage-model.md). Use this file for public
labels, internal nouns, legacy import aliases, ownership, and relationships,
not as the source of truth for exact fields or saved-file formats.

## Model Rules

- DeKoi records are native records, not renamed legacy records.
- Cute or themed labels should not hide what a record actually does.
- Persisted records should keep IDs, timestamps, and schema versions in their
  typed contracts where the current storage model requires them.
- Keep the public label, internal type name, and legacy import alias separate.
- Prefer clear common nouns over cute names for core workflows.
- Generic ecosystem terms are fine when they come from broader SillyTavern-style
  conventions rather than product language specific to previous projects.
- Avoid reusing legacy mode IDs, route names, prompt labels, UI copy, or feature
  descriptions.
- Write the DeKoi requirement first, then name the surface from that behavior.
- Keep compatibility code one-way: legacy source shape -> DeKoi native shape
  (see [PROVENANCE.md](./PROVENANCE.md)).

Candidate labels and alternates considered live in
[docs/naming-decisions.md](./docs/naming-decisions.md); this file records the
rules and the current decisions.

## Surface Map

| Legacy source concept         | DeKoi public label | DeKoi internal noun | Purpose                                                                       |
| ----------------------------- | ------------------ | ------------------- | ----------------------------------------------------------------------------- |
| Conversation-style mode       | Messenger          | messenger thread    | Direct and group DM-style chats with compact message turns.                   |
| Roleplay-style mode           | Roleplay           | roleplay thread     | Visual-novel-style character scenes with cast, continuity, and world context. |
| Chat list/sidebar             | Pond               | thread list         | Saved Messenger and Roleplay records.                                         |
| Character catalog             | Companions         | character record    | People/entities the user can talk with or place into Roleplay threads.        |
| Persona catalog               | Personas           | persona record      | User-facing identities for participation in Messenger and Roleplay threads.   |
| Lorebook/knowledge catalog    | Lorebooks          | lorebook record     | Reusable facts, setting notes, references, and continuity material.           |
| Prompt presets                | Presets            | prompt preset       | Reusable generation settings and prompt structure.                            |
| Game-state/tracker-style data | Ripples            | ripple state        | Dynamic per-branch state, counters, summaries, and continuity changes.        |
| Tracker sidebar panel         | Ripple Dock        | ripple dock         | Sidebar surface for viewing and editing Ripples.                              |
| Automation/helper catalog     | Agents             | agent               | Optional automated reviewers, trackers, or generators.                        |
| Connections/providers         | Connections        | provider connection | Model, local runtime, and service configuration.                              |
| Gallery/sprites/assets        | Media              | media asset         | User-owned images, sprites, audio, and generated visual assets.               |

## Product Naming Decisions

Use **Messenger** for DM-style chat.

Why:

- It is immediately understandable to nontechnical users.
- It works for both one-on-one and group chats.
- It avoids over-theming the core workflow.
- It lets the saved object still be a **thread**, which is a useful internal
  noun.

Suggested Messenger language:

- Public navigation: `Messenger`
- Primary action: `New thread`
- One-on-one subtype: `Direct Messenger`
- Multi-participant subtype: `Group Messenger`
- Internal kind: `messenger`
- Core record: `ModeThread` with `kind: "messenger"`
- Import adapter alias only: `legacy conversation source`

Avoid using `Conversation Mode` as public text or `conversation` as a native
DeKoi mode ID.

Use **Roleplay** as the public surface label for visual-novel-style character
scenes.

Suggested Roleplay language:

- Public navigation: `Roleplay`
- Primary action: `New Roleplay`
- Internal kind: `roleplay`
- Core record: `ModeThread` with `kind: "roleplay"`
- Import adapter alias only: `legacy roleplay source`

Avoid using `Roleplay Mode` as public text. Use `roleplay` only as the native
surface ID, not as a legacy mode label.

Use **Ripples** as the public label for dynamic per-branch state.

This covers things that may eventually include:

- character presence or mood
- relationship notes
- counters or meters
- continuity changes
- compact summaries of what shifted in a thread

Suggested Ripple language:

- Public surface: `Ripples`
- Sidebar/panel surface: `Ripple Dock`
- Internal noun: `RippleState`
- UI component noun: `RippleDock`
- Single change/event: `Ripple`
- Import adapter alias only: `legacy game-state source` or
  `legacy tracker source`

Avoid using `Game State` as a native DeKoi label. Ripples should not imply that
game/adventure-style play is in scope right now.

## Generic Ecosystem Terms

DeKoi can keep common AI-character-chat terms when they are user-familiar,
generic, and not treated as previous project product language.

Safe examples:

- `persona`
- `lorebook`
- `character card`
- `preset`

The provenance risk is not the generic term by itself. The risk is copying
previous project wording, data shape, prompt text, UI layout, or behavior
without rewriting the DeKoi requirement first.

## Notes From Legacy Stocktake

The old app groups behavior into three large mode surfaces, a content catalog,
shell/settings surfaces, runtime/provider generation, and native/Tauri storage.
For DeKoi, those should become independent product concepts rather than direct
renames of folders or routes.

High-risk inherited labels to avoid as native concepts:

- `conversation`
- `game mode`
- `game state`
- `chat mode`
- prior-project automation labels

Acceptable as generic implementation words only when they are not product
surface names:

- `message`
- `thread`
- `character`
- `persona`
- `lorebook`
- `preset`
- `scene`
- `provider`
- `connection`

## First Product Areas

The first polished DeKoi loop is **Messenger**.

A Messenger thread is a DM-style thread between the user and one or more
characters. It should feel like a private or group message chat: compact turns,
quick replies, clear speakers, and saved history.

Roleplay now exists as the second native surface. It reuses characters,
personas, lorebooks, providers, the shared mode-thread substrate, and Ripples
where that makes sense, while keeping its prompt assembly, generation behavior,
and scene presentation distinct from Messenger.

Game/adventure-style play is intentionally out of scope for now.

## Core Records

### Character

A character is someone or something the user can talk with or place into
Roleplay.
The current public surface label for characters is **Companions**.

Purpose:

- Store the character's identity and descriptive material.
- Provide enough context for a model to write as that character.
- Own character-specific media such as avatar or sprite references later.

Likely relationships:

- Can appear in many Messenger threads.
- Can appear in many Roleplay threads.
- Can reference lorebooks; media can attach later.

Not fully settled yet:

- Deeper character card field depth.
- Legacy character-card import compatibility.
- Sprite and avatar storage.

### Persona

A persona is one of the user's in-world or chat identities.

Purpose:

- Let the user choose who they are in Messenger or Roleplay.
- Hold user-facing description, display name, and optional style/context.
- Avoid hard-coding a single global user identity.

Likely relationships:

- A Messenger thread may have one active persona.
- A Roleplay thread may have one active persona.
- A persona can be reused across many threads.
- Can reference lorebooks that travel with that persona into generation.

Not fully settled yet:

- Whether a default persona is required.
- Whether personas can have media/sprites in the first slice.

### Lorebook

A lorebook is a reusable collection of facts, notes, and context.

Purpose:

- Keep world, character, setting, relationship, and continuity notes available.
- Let the user attach reusable knowledge without pasting it into every thread.
- Support future context selection without copying another app's schema.

Likely relationships:

- Can be attached to characters.
- Can be attached to personas.
- Can be attached to Messenger or Roleplay threads.
- Can be attached globally through app settings.
- Can contain many lore entries.

Current implementation:

- Lorebooks and lore entries are `schemaVersion: 2` records with activation,
  inclusion, placement, trigger, filter, timing, match-source, and budget
  fields.
- Messenger and Roleplay prompt assembly resolves lorebooks from the chat or
  scene, active persona, selected companions, and global app settings before
  provider requests. Current built-in macros resolve across lore summaries,
  entry bodies, and opted-in companion/persona match-source fields during prompt
  assembly. Constant entries activate unless blocked by timing delay or delayed
  until recursion, selective entries match keys against recent transcript text
  and opted-in companion/persona fields, recursive scan can let resolved
  activated entry bodies unlock further entries, per-branch lore runtime state
  applies sticky and cooldown timers, inclusion groups collapse to one winner
  before per-entry probability runs except for sticky activations, and activated
  entries are ordered by the saved insertion strategy, placed, and
  budget-trimmed deterministically using resolved prompt text. Generation
  triggers and character filters restrict activation to the current action and
  selected reply target. The catalog UI exposes the matching, inclusion,
  probability, placement, recursion, timed effect, trigger, character-filter,
  and budget controls; companion, persona, thread, and global settings choose
  which lorebooks participate.
- Exact activation, ordering, and budgeting mechanics live in
  [docs/storage-model.md](./docs/storage-model.md).

Not fully settled yet:

- Exact tokenizer-backed budgeting.
- Import format.

### Prompt Preset

A prompt preset is reusable generation configuration.

Purpose:

- Store model behavior preferences separately from a thread.
- Let users reuse temperature, length, style, and prompt-structure choices.
- Keep provider configuration separate from creative configuration.

Likely relationships:

- A Messenger thread may use one active prompt preset.
- A Roleplay thread may use one active prompt preset.
- Messenger and Roleplay branches may store branch-specific choices for the selected
  preset without changing the reusable preset record.
- A future Thread Preset may hold broader chat-specific settings that should
  travel with one saved thread instead of with reusable generation defaults.

Current implementation:

- Prompt presets are `schemaVersion: 1` catalog records with a title, optional
  summary, optional system and Messenger Prompt Source text, nullable metadata
  and parameters, a current generation sampling projection, static variable
  values, ordered sections/groups, and choice blocks. Native records retain
  stable empty arrays/maps and `systemPrompt: ""` when optional parts are absent.
- The Presets catalog edits Roleplay section groups, ordered sections, marker
  sections, section roles, enabled state, wrapping, depth placement, choice
  blocks, options, reusable defaults, questions, option descriptions,
  presentation, and ordering. Choice questions are always visible and
  independent. Its edit flow preserves
  static variable values, richer parameters, folder/author metadata,
  compatibility-only variable-order slots, and Messenger Prompt Source even
  where dedicated controls are not exposed.
- The Presets catalog imports one compatible prompt-preset package as a fresh
  native record and exports one selected saved record as a stable DeKoi-owned
  `.json` package. Standalone preset files are not full storage bundles.
- New Messenger and Roleplay threads select the current app default prompt
  preset. Each thread can later select one prompt preset. Messenger uses
  the selected preset's `messengerPrompt`, then its shared `systemPrompt`, and
  falls back to built-in `DEFAULT_MESSENGER_SYSTEM_PROMPT` when no usable
  selected preset prompt exists. A blank preset does not store that built-in
  fallback text. Ordinary Messenger settings have no
  conversation-owned arbitrary prompt or model-parameter override. Messenger
  does not consume preset sections. Roleplay uses sections and groups when the
  selected preset has usable sections; otherwise it uses the selected preset
  system prompt, then the built-in Roleplay prelude when neither has usable
  text. Either form preserves the preset's narration and other-NPC output
  behavior. Only no-preset,
  single-character Roleplay uses the Roleplay-owned one-character output
  contract.
- Prompt-preset static `variableValues` and the active preset's confirmed
  per-branch choice selections become request-local prompt variables at
  generation time. Choice selections are saved on the active Messenger or
  Roleplay branch, not in `MacroVariableScope`. Branch selections use stable
  choice-block and option IDs and retain separate
  histories per preset. Messenger and Roleplay mode owners repair invalid
  confirmed choices after live preset edits, persist the valid defaults, and
  surface a repair notice without creating confirmations for unanswered
  presets.
- Both Messenger and Roleplay settings expose Preset Variables without changing
  the reusable preset record. Variable edits remain a dialog-local draft until
  Confirm or Use Defaults; canceling a first-use preset change preserves the
  previous preset and history. First use blocks generation until choices are
  confirmed, while choice-free presets record an empty confirmed history
  without opening the dialog. Returning to a preset restores its separate
  history, and the active preset's variables can be reopened manually.
- Switching Messenger to a different preset changes the selected preset and its
  per-preset choice history. A stored non-empty custom branch prompt overrides
  preset prompt sources, although ordinary Messenger settings do not expose an
  arbitrary prompt editor.
- DeKoi seeds an editable starter preset on first run and treats later edits or
  deletion as user-owned data.

Still evolving:

- UI for editing advanced compatible parameters, static variables, and metadata.
- Whether Thread Presets become a separate saved record.

### Provider Connection

A provider connection is a configured way to request model output.

Purpose:

- Keep API/local-runtime details away from character and thread records.
- Let the app support different providers later.
- Make provider support replaceable behind one DeKoi-owned boundary.
- Keep provider API keys out of durable provider connection records and DeKoi
  storage bundles.

Likely relationships:

- A Messenger or Roleplay thread may choose a connection.
- A preset may be compatible with some connections.

Not fully settled yet:

- Final provider roster and provider-specific capability depth.
- Provider support depth outside the current desktop secret-backed path.

## Unified Mode-Thread Foundation

`ModeThread` is the native React-free substrate for Messenger and Roleplay. It
keeps `messenger` and `roleplay` as truthful
discriminated kinds rather than erasing their product differences. A thread has
one or more same-kind branches; messages belong to exactly one thread and
branch and have one or more versions with one active version.

Branches own participants, active Persona, lorebooks, prompt preset,
per-preset confirmed-choice history, provider connection, and timestamps.
Roleplay branches additionally own their reply strategy, while a Roleplay
thread may record its opening Companion. Message authors use the native
`persona`, `character`, `system`, or `unknown` discriminators and store a
historical display label; Character is presented publicly as Companion. System
is the neutral author kind and is not a generated-reply target.

The foundation validates exact native shapes, canonical IDs, ownership,
discriminators, nonempty branches and versions, active references, and
monotonic parseable timestamps. Its pure actions isolate branch mutations,
retain preset choice histories when presets change, and order activity from
thread metadata plus message and active-version updates.

Messenger and Roleplay use mode-owned factories, actions, prompt builders, and
screens over this shared substrate. App state uses one `modeThreads` array and
durable storage projects it into `mode-threads` plus `mode-messages`. The
foundation deliberately has no generic cross-mode thread factory, `sceneText`,
conversation-level prompt override, legacy aliases, or visible branch/version
UI.

## Messenger Records

### Messenger Mode Thread

A Messenger mode thread is a `ModeThread` with `kind: "messenger"`.

Purpose:

- Group Messenger messages into one saved thread.
- Track participants, active persona, optional preset, optional lorebooks, and
  assembled message history.
- Reopen cleanly without needing provider access.

Likely relationships:

- Has one or more character participants.
- May have one active persona.
- Contains branch-owned `ModeMessage` records.
- May attach chat-specific lorebooks, choose an active prompt preset, and choose
  prompt-preset choice selections and a provider connection; media can attach
  later.

Important behavior:

- One-on-one and group Messenger threads should be the same record kind with different
  participant counts.
- A Messenger thread does not require Roleplay scene state.
- The Messenger UI and generation path use only the active branch and active
  message versions while keeping Messenger-specific behavior in its mode owner.
- Durable storage keeps thread metadata and messages in the shared native
  collection pair, while UI and generation receive assembled mode threads.

Still evolving:

- Whether the public action should be `New thread`, `New Messenger`, or both.
- Whether group Messenger threads use one shared character response or separate character
  turns.

### ModeMessage

A `ModeMessage` is one versioned transcript item inside a Messenger or Roleplay
branch.

Purpose:

- Store who said what and when.
- Preserve enough information to render the thread later.
- Leave room for generated, edited, imported, or manually written messages.

Likely relationships:

- Belongs to exactly one mode thread and branch.
- Has an author reference: user persona, character, system/app, or unknown
  imported source.
- Has one or more complete versions and one active version.

Important behavior:

- Messages should support plain text first.
- Attachments, reactions, edits, and status indicators can come later.
- Provider-specific response metadata should not become the message model.

Still evolving:

- Future author metadata beyond the current persona, character, system, and
  unknown author kinds.
- Attachment format.

## Roleplay Records

### Roleplay Mode Thread

A Roleplay mode thread is a `ModeThread` with `kind: "roleplay"`.

Purpose:

- Present longer character interactions with stronger scene framing than
  Messenger.
- Reuse characters, personas, lorebooks, presets, media, and providers.
- Leave room for sprites, backgrounds, speaker presentation, and continuity.

Likely relationships:

- Has one or more character participants.
- May have one active persona.
- May attach lorebooks and choose a provider connection.
- May choose one active prompt preset and prompt-preset choice selections.
- Contains branch-owned `ModeMessage` records.
- May reference scene media later.

Important behavior:

- Thread settings update Roleplay participants, persona, lorebooks, prompt
  preset, and provider connection through Roleplay-owned actions instead of
  Messenger records.
- Thread settings expose preset-variable choices for the selected prompt
  preset. Choosing the preset default removes the thread override.
- Durable storage uses the same mode-thread/message collection pair as
  Messenger, while Roleplay keeps its own prompt, generation, and display
  behavior.

Still evolving:

- Deeper Roleplay turn semantics beyond the current mode-message shape.
- Sprite/background ownership.

## Shared State Records

### LoreRuntimeState

LoreRuntimeState is internal per-branch state for timed lorebook effects.

Purpose:

- Keep sticky and cooldown timers durable without putting mutable counters on
  reusable lorebook entries.
- Scope lore timing to one mode branch.
- Let prompt assembly reset timers when a lore entry changes or when a thread is
  deleted or cleared.

Current implementation:

- LoreRuntimeState uses `ownerKind: "mode-branch"` and the owning branch ID.
- It stores active timers by lorebook entry, using the lore entry's `updatedAt`
  to discard stale timers after edits.
- It is saved locally and included in DeKoi storage bundles, with orphaned
  states skipped on bundle import.

### MacroVariableScope

MacroVariableScope is internal owner-scoped state for dynamic prompt macro
variables.

Purpose:

- Keep variable macro values durable without putting prompt scratch state on
  thread records.
- Share global variables with Messenger and Roleplay while allowing branch-level
  overrides.
- Persist only variable mutations that survive successful generation.

Current implementation:

- One global scope uses `ownerKind: "global"` and `ownerId: "global"`.
- Mode branch scopes use `ownerKind: "mode-branch"` and the owning branch ID,
  are saved locally, and are included in DeKoi storage bundles.
- Generation starts with global variables overlaid by the active branch scope;
  existing global-only keys stay global when mutated, and new keys are saved to
  the branch scope.
- Thread deletion, branch transcript clearing, and bundle import orphan cleanup
  remove branch-scoped macro variable state. Prompt-preset static and choice variables
  are request inputs, not MacroVariableScope records.

### RippleState

RippleState is the DeKoi name for dynamic per-branch state.
The current public sidebar/panel label for this state is **Ripple Dock**.

Purpose:

- Track changing conditions without making game/adventure-style play part of the
  first product slice.
- Give Messenger and Roleplay a future place for continuity changes, counters, moods,
  relationship notes, or other stateful details.

Likely relationships:

- Belongs to one mode branch through `ownerKind: "mode-branch"` and its branch
  ID.
- May be updated manually or by future helper modules.
- May contain many individual Ripples.

Not fully settled yet:

- Whether Ripples stay freeform notes or grow structured fields/event logs.
- Whether Roleplay and Messenger share one state shape.

### RippleDock

RippleDock is the reserved UI surface name for viewing and editing Ripples.

Purpose:

- Keep the visible panel name separate from the underlying RippleState record.
- Allow a sidebar-style implementation without making `sidebar` part of the
  product identity.

Likely relationships:

- Reads and edits RippleState for the active Messenger or Roleplay branch.
- May be hidden, docked, or expanded depending on layout.

Not fully settled yet:

- Exact Roleplay panel layout.
- Which future structured Ripple fields are editable.

Current implementation:

- Messenger has the first RippleDock slice.
- Ripples are editable freeform records with `note`, `shift`, and `meter` tones.
- RippleState is saved locally and included in DeKoi storage bundles.

## Implemented Slice

Messenger is the most mature loop; Roleplay is the second native surface with
thread settings and send guards. What works now, what is experimental, and
what is out of scope live in
[docs/project-status.md](./docs/project-status.md).

## Later Boundaries

### Storage Contract

Exact storage fields, collection names, defaults, versioning, and normalization
rules live in the TypeScript contracts and [Storage Model](./docs/storage-model.md).
This glossary should change when product nouns or relationships change, not for
every field-level storage edit.

### Legacy Import

Legacy import is a one-way adapter into DeKoi-native records; see
[PROVENANCE.md](./PROVENANCE.md). Import code may know old source shapes, but
core DeKoi records do not expose legacy names as their native model. Current
legacy import may translate old catalog and provider aliases into native
companion, persona, provider connection, Messenger, and MacroVariableScope
records before append.

### Provider Runtime

Provider support should sit behind a DeKoi request/response contract. Thread,
character, persona, lorebook, and preset records should not depend on one
provider's API shape.

### Prompt Preset Relationships

`AppSettings.defaultPromptPresetId` is the single native default authority;
`PromptPresetRecord` does not carry a default flag. Messenger and Roleplay
branches keep confirmed variable choices in
`presetChoiceSelectionsByPresetId`, retaining history when switching presets
or when a deleted preset ID remains in history. New thread branches use the
current default. The default and last preset cannot be deleted; deleting another
preset reassigns every branch using it to the default without erasing history.

Snapshot/bundle normalization restores the exact bundled starter when no usable
preset remains, repairs a missing default to the first usable preset, and
reassigns dangling active references to that default while preserving imported
IDs. Standalone preset-file import restamps the imported preset and does not
change the app default.

Development data written with the removed native fields may be reset through
storage repair/reload; the legacy single-history field is accepted only as a
one-way normalization into the history map.

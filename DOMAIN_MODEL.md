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
| Game-state/tracker-style data | Ripples            | ripple state        | Dynamic per-thread state, counters, summaries, and continuity changes.        |
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
- Core record: `MessengerThread`
- Import adapter alias only: `legacy conversation source`

Avoid using `Conversation Mode` as public text or `conversation` as a native
DeKoi mode ID.

Use **Roleplay** as the public surface label for visual-novel-style character
scenes.

Suggested Roleplay language:

- Public navigation: `Roleplay`
- Primary action: `New Roleplay`
- Internal kind: `roleplay`
- Core record: `RoleplayThread`
- Import adapter alias only: `legacy roleplay source`

Avoid using `Roleplay Mode` as public text. Use `roleplay` only as the native
surface ID, not as a legacy mode label.

Use **Ripples** as the public label for dynamic per-thread state.

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
personas, lorebooks, providers, generation contracts, split transcript storage,
and Ripples where that makes sense, while keeping room for scene presentation
and continuity needs that diverge from Messenger.

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
  activated entry bodies unlock further entries, per-thread lore runtime state
  applies sticky and cooldown timers, inclusion groups collapse to one winner
  before per-entry probability runs except for sticky activations, and activated
  entries are ordered by the saved insertion strategy, placed, and
  budget-trimmed deterministically using resolved prompt text. The catalog UI
  exposes the matching, inclusion, probability, placement, recursion, timed
  effect, and budget controls; companion, persona, thread, and global settings
  choose which lorebooks participate.
- Exact activation, ordering, and budgeting mechanics live in
  [docs/storage-model.md](./docs/storage-model.md).

Not fully settled yet:

- Triggers, character filters, and exact tokenizer-backed budgeting.
- UI for triggers and character filters.
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
- A Thread Preset may later hold chat-specific settings that should travel
  with one saved thread instead of with reusable generation defaults.

Current implementation:

- Prompt presets are `schemaVersion: 1` catalog records with a title, optional
  summary, required system prompt, and optional temperature, top-p, and
  max-token sampling.
- Messenger and Roleplay threads can select one prompt preset. Messenger custom
  thread system prompts still win over a selected preset; otherwise the selected
  preset replaces the default Messenger prompt. Roleplay uses the selected
  preset as its system prelude, then still appends the Roleplay-owned
  one-character output contract.
- DeKoi seeds an editable starter preset on first run and treats later edits or
  deletion as user-owned data.

Still evolving:

- Whether prompt presets stay simple or split into advanced template parts.
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

## Messenger Records

### MessengerThread

A MessengerThread is a saved DM-style conversation.

Purpose:

- Group Messenger messages into one saved thread.
- Track participants, active persona, optional preset, optional lorebooks, and
  assembled message history.
- Reopen cleanly without needing provider access.

Likely relationships:

- Has one or more character participants.
- May have one active persona.
- Contains many MessengerMessages.
- May attach chat-specific lorebooks, choose an active prompt preset, and choose
  a provider connection; media can attach later.

Important behavior:

- One-on-one and group Messenger threads should be the same record kind with different
  participant counts.
- A MessengerThread should not require Roleplay scene state.
- A MessengerThread should be understandable even before generation support exists.
- Durable storage keeps MessengerMessages in a separate collection keyed by
  thread ID, while UI and generation receive assembled MessengerThread objects.

Still evolving:

- Whether the public action should be `New thread`, `New Messenger`, or both.
- Whether group Messenger threads use one shared character response or separate character
  turns.

### MessengerMessage

A MessengerMessage is one visible message inside a MessengerThread.

Purpose:

- Store who said what and when.
- Preserve enough information to render the thread later.
- Leave room for generated, edited, imported, or manually written messages.

Likely relationships:

- Belongs to exactly one MessengerThread.
- Has an author reference: user persona, character, system/app, or unknown
  imported source.

Important behavior:

- Messages should support plain text first.
- Attachments, reactions, edits, and status indicators can come later.
- Provider-specific response metadata should not become the message model.

Still evolving:

- Future author metadata beyond the current persona, character, system, and
  unknown author kinds.
- Edit history.
- Attachment format.

## Roleplay Records

### RoleplayThread

A RoleplayThread is a saved visual-novel-style character scene.

Purpose:

- Present longer character interactions with stronger scene framing than
  Messenger.
- Reuse characters, personas, lorebooks, presets, media, and providers.
- Leave room for sprites, backgrounds, speaker presentation, and continuity.

Likely relationships:

- Has one or more character participants.
- May have one active persona.
- May attach lorebooks and choose a provider connection.
- May choose one active prompt preset.
- Contains RoleplayEntries.
- May reference scene media later.

Important behavior:

- Thread settings update Roleplay participants, persona, lorebooks, prompt
  preset, and provider connection through Roleplay-owned actions instead of
  Messenger records.
- Durable storage keeps RoleplayEntries in a separate collection keyed by thread
  ID, while UI and generation receive assembled RoleplayThread objects.

Still evolving:

- Deeper Roleplay turn semantics beyond the first RoleplayEntry shape.
- Sprite/background ownership.

## Shared State Records

### LoreRuntimeState

LoreRuntimeState is internal per-thread state for timed lorebook effects.

Purpose:

- Keep sticky and cooldown timers durable without putting mutable counters on
  reusable lorebook entries.
- Scope lore timing to one MessengerThread or RoleplayThread.
- Let prompt assembly reset timers when a lore entry changes or when a thread is
  deleted or cleared.

Current implementation:

- LoreRuntimeState belongs to one MessengerThread or RoleplayThread.
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
- Share global variables with Messenger and Roleplay while allowing thread-level
  overrides.
- Persist only variable mutations that survive successful generation.

Current implementation:

- One global scope uses `ownerKind: "global"` and `ownerId: "global"`.
- MessengerThread and RoleplayThread scopes use the owning thread ID, are saved
  locally, and are included in DeKoi storage bundles.
- Generation starts with global variables overlaid by the active thread scope;
  existing global-only keys stay global when mutated, and new keys are saved to
  the thread scope.
- Thread deletion, transcript clearing, and bundle import orphan cleanup remove
  thread-scoped macro variable state. Preset-toggle variables are request inputs,
  not MacroVariableScope records.

### RippleState

RippleState is the DeKoi name for dynamic per-thread state.
The current public sidebar/panel label for this state is **Ripple Dock**.

Purpose:

- Track changing conditions without making game/adventure-style play part of the
  first product slice.
- Give Messenger and Roleplay a future place for continuity changes, counters, moods,
  relationship notes, or other stateful details.

Likely relationships:

- Belongs to one MessengerThread or RoleplayThread.
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

- Reads and edits RippleState for the active MessengerThread or RoleplayThread.
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

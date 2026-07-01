# Domain Model

This document is DeKoi's plain-language product-record glossary. Exact
TypeScript contracts now live under `src/engine/contracts/types`, and durable
collection rules live in [docs/storage-model.md](./docs/storage-model.md). Use
this file for names, ownership, and relationships, not as the source of truth
for exact fields or saved-file formats.

## Model Rules

- DeKoi records are native records, not renamed legacy records.
- Public labels, internal nouns, and import-source aliases stay separate.
- Generic ecosystem terms such as `persona`, `lorebook`, `character card`, and
  `preset` are allowed when used as broad AI-character-chat vocabulary.
- Cute or themed labels should not hide what a record actually does.
- Persisted records should keep IDs, timestamps, and schema versions in their
  typed contracts where the current storage model requires them.

## First Product Areas

The first DeKoi loop is **Messenger**.

A Messenger thread is a DM-style thread between the user and one or more
characters. It should feel like a private or group message chat: compact turns,
quick replies, clear speakers, and saved history.

Roleplay now exists as the second native surface in early form. It reuses
characters, personas, lorebooks, providers, generation contracts, split
transcript storage, and Ripples where that makes sense, while keeping room for
scene presentation and continuity needs that diverge from Messenger.

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
- Can reference lorebooks, presets, or media later.

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
- Can be attached to Messenger or Roleplay threads.
- Can contain many lore entries.

Not fully settled yet:

- Keyword activation rules.
- Entry priority and token budgeting.
- Import format.

### Preset

A preset is reusable generation configuration.

Purpose:

- Store model behavior preferences separately from a thread.
- Let users reuse temperature, length, style, and prompt-structure choices.
- Keep provider configuration separate from creative configuration.

Likely relationships:

- A Messenger thread may use one active preset.
- A Roleplay thread may use one active preset.
- Presets may be global or copied into a thread later if needed.

Not fully settled yet:

- Exact parameters.
- Prompt-template format.
- Whether presets are simple at first or split into advanced recipe parts.

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
- May reference lorebooks, presets, media, and provider connections later.

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
- Contains RoleplayEntries.
- May reference scene media later.

Important behavior:

- Durable storage keeps RoleplayEntries in a separate collection keyed by thread
  ID, while UI and generation receive assembled RoleplayThread objects.

Still evolving:

- Deeper Roleplay turn semantics beyond the first RoleplayEntry shape.
- Sprite/background ownership.

## Shared State Records

### RippleState

RippleState is the DeKoi name for dynamic per-thread state.
The current public sidebar/panel label for this state is **Ripple Dock**.

Purpose:

- Replace game-state/tracker-style wording with a DeKoi-owned concept.
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

- Replace tracker-sidebar-panel-style wording with a DeKoi-owned surface name.
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

The first useful implementation has moved past the original Messenger-only
proof. The current app proves:

1. Create and edit Companions, Personas, Lorebooks, and provider connections.
2. Create Messenger and Roleplay threads.
3. Store MessengerMessages and RoleplayEntries in split transcript collections.
4. Save and reload DeKoi-native records through desktop storage or a compatible
   remote runtime.
5. Export and import DeKoi-native bundles through the desktop host.
6. Import legacy threads one way into native Messenger records.
7. Generate provider-backed Messenger and Roleplay replies through the runtime
   boundary.

Messenger remains the first polish target. Roleplay, provider transport,
desktop storage, bundle import/export, legacy import, and Ripples are present in
early form and should keep deepening behind the same native record boundaries.

## Later Boundaries

### Storage Contract

Exact storage fields, collection names, defaults, versioning, and normalization
rules live in the TypeScript contracts and [Storage Model](./docs/storage-model.md).
This glossary should change when product nouns or relationships change, not for
every field-level storage edit.

### Legacy Import

Legacy import should be a one-way adapter:

`legacy source record -> DeKoi native record`

Import code may know old source shapes. Core DeKoi records should not expose
legacy names as their native model.

### Provider Runtime

Provider support should sit behind a DeKoi request/response contract. Thread,
character, persona, lorebook, and preset records should not depend on one
provider's API shape.

# Domain Model

This document defines DeKoi's first native product records in plain language.
It is not a storage schema yet. Use it to agree on names, ownership, and
relationships before writing TypeScript types, saved-file formats, migrations,
or import adapters.

## Model Rules

- DeKoi records are native records, not renamed legacy records.
- Public labels, internal nouns, and import-source aliases stay separate.
- Generic ecosystem terms such as `persona`, `lorebook`, `character card`, and
  `preset` are allowed when used as broad AI-character-chat vocabulary.
- Cute or themed labels should not hide what a record actually does.
- Every durable record should eventually carry an ID, timestamps, and a schema
  version, but this document does not define exact fields yet.

## First Product Area

The first DeKoi loop is **Bubbles**.

A Bubble is a DM-style thread between the user and one or more characters. It
should feel like a private or group message chat: compact turns, quick replies,
clear speakers, and saved history.

VN is reserved as the second major surface. It should reuse characters,
personas, lorebooks, presets, and providers where that makes sense, but its
scene presentation and continuity needs can diverge from Bubbles.

Game/adventure-style play is intentionally out of scope for now.

## Core Records

### Character

A character is someone or something the user can talk with or place into a VN.
The current public surface label for characters is **Companions**.

Purpose:

- Store the character's identity and descriptive material.
- Provide enough context for a model to write as that character.
- Own character-specific media such as avatar or sprite references later.

Likely relationships:

- Can appear in many Bubble threads.
- Can appear in many VN threads.
- Can reference lorebooks, presets, or media later.

Not decided yet:

- Exact character card field names.
- SillyTavern import compatibility.
- Sprite and avatar storage.

### Persona

A persona is one of the user's in-world or chat identities.

Purpose:

- Let the user choose who they are in a Bubble or VN.
- Hold user-facing description, display name, and optional style/context.
- Avoid hard-coding a single global user identity.

Likely relationships:

- A Bubble thread may have one active persona.
- A VN thread may have one active persona.
- A persona can be reused across many threads.

Not decided yet:

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
- Can be attached to Bubble or VN threads.
- Can contain many lore entries.

Not decided yet:

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

- A Bubble thread may use one active preset.
- A VN thread may use one active preset.
- Presets may be global or copied into a thread later if needed.

Not decided yet:

- Exact parameters.
- Prompt-template format.
- Whether presets are simple at first or split into advanced recipe parts.

### Provider Connection

A provider connection is a configured way to request model output.

Purpose:

- Keep API/local-runtime details away from character and thread records.
- Let the app support different providers later.
- Make provider support replaceable behind one DeKoi-owned boundary.

Likely relationships:

- A Bubble or VN thread may choose a connection.
- A preset may be compatible with some connections.

Not decided yet:

- First provider.
- Secret storage.
- Tauri vs browser-only runtime boundary.

## Bubble Records

### BubbleThread

A BubbleThread is a saved DM-style conversation.

Purpose:

- Group Bubble messages into one saved thread.
- Track participants, active persona, optional preset, optional lorebooks, and
  message history.
- Reopen cleanly without needing provider access.

Likely relationships:

- Has one or more character participants.
- May have one active persona.
- Contains many BubbleMessages.
- May reference lorebooks, presets, media, and provider connections later.

Important behavior:

- One-on-one and group Bubbles should be the same record kind with different
  participant counts.
- A BubbleThread should not require VN scene state.
- A BubbleThread should be understandable even before generation support exists.

Not decided yet:

- Whether the public action should be `New thread`, `New Bubble`, or both.
- Whether group Bubbles use one shared character response or separate character
  turns.
- Exact saved-file shape.

### BubbleMessage

A BubbleMessage is one visible message inside a BubbleThread.

Purpose:

- Store who said what and when.
- Preserve enough information to render the thread later.
- Leave room for generated, edited, imported, or manually written messages.

Likely relationships:

- Belongs to exactly one BubbleThread.
- Has an author reference: user persona, character, system/app, or unknown
  imported source.

Important behavior:

- Messages should support plain text first.
- Attachments, reactions, edits, and status indicators can come later.
- Provider-specific response metadata should not become the message model.

Not decided yet:

- Exact role names.
- Edit history.
- Attachment format.

## VN Records

### VisualNovelThread

A VisualNovelThread is a saved visual-novel-style character scene.

Purpose:

- Present longer character interactions with stronger scene framing than
  Bubbles.
- Reuse characters, personas, lorebooks, presets, media, and providers.
- Leave room for sprites, backgrounds, speaker presentation, and continuity.

Likely relationships:

- Has one or more character participants.
- May have one active persona.
- Contains scene turns or script entries.
- May reference scene media later.

Not decided yet:

- Exact VN turn model.
- Whether VN uses BubbleMessage-compatible messages or a separate scene-entry
  record.
- Sprite/background ownership.

## Reserved Records

### RippleState

RippleState is the reserved DeKoi name for dynamic per-thread state.
The current public sidebar/panel label for this state is **Ripple Dock**.

Purpose:

- Replace game-state/tracker-style wording with a DeKoi-owned concept.
- Track changing conditions without making game/adventure-style play part of the
  first product slice.
- Give Bubbles and VN a future place for continuity changes, counters, moods,
  relationship notes, or other stateful details.

Likely relationships:

- Belongs to one BubbleThread or VisualNovelThread.
- May be updated manually or by future helper modules.
- May contain many individual Ripples.

Not decided yet:

- Whether Ripples are freeform notes, structured fields, event logs, or a mix.
- Whether BubbleThread needs RippleState in the first local prototype.
- Whether VN and Bubbles share one state shape.

### RippleDock

RippleDock is the reserved UI surface name for viewing and editing Ripples.

Purpose:

- Replace tracker-sidebar-panel-style wording with a DeKoi-owned surface name.
- Keep the visible panel name separate from the underlying RippleState record.
- Allow a sidebar-style implementation without making `sidebar` part of the
  product identity.

Likely relationships:

- Reads and edits RippleState for the active BubbleThread or VisualNovelThread.
- May be hidden, docked, or expanded depending on layout.

Not decided yet:

- Exact panel layout.
- Which Ripples are editable in the first version.
- Whether this UI appears in Bubbles, VN, or only VN at first.

## First Implementation Slice

The first useful implementation should prove:

1. Create or define one character.
2. Create one BubbleThread.
3. Add user-authored BubbleMessages.
4. Add placeholder character BubbleMessages without a provider.
5. Save and reload the thread locally.

This proves the DeKoi-native model before adding providers, Tauri file storage,
VN presentation, or legacy import.

## Later Boundaries

### Storage Schema

The storage schema should come after these nouns settle. It should define exact
field names, defaults, versioning, and migrations.

### Legacy Import

Legacy import should be a one-way adapter:

`legacy source record -> DeKoi native record`

Import code may know old source shapes. Core DeKoi records should not expose
legacy names as their native model.

### Provider Runtime

Provider support should sit behind a DeKoi request/response contract. Thread,
character, persona, lorebook, and preset records should not depend on one
provider's API shape.

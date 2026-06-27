# Surface Labels

DeKoi should use its own product vocabulary for public UI, internal domain
types, and import adapters. Legacy names can be mentioned only as import-source
concepts while mapping old records into DeKoi-owned models.

## Naming Rules

- Keep the public label, internal type name, and legacy import alias separate.
- Prefer clear common nouns over cute names for core workflows.
- Generic ecosystem terms are fine when they come from broader SillyTavern-style
  conventions rather than product language specific to previous projects.
- Avoid reusing legacy mode IDs, route names, prompt labels, UI copy, or feature
  descriptions.
- Write the DeKoi requirement first, then name the surface from that behavior.
- Keep compatibility code one-way: legacy source shape -> DeKoi native shape.

## First-Pass Surface Map

| Legacy source concept | DeKoi public label | DeKoi internal noun | Purpose |
| --- | --- | --- | --- |
| Conversation-style mode | Messenger | messenger thread | Direct and group DM-style chats with compact message turns. |
| Roleplay-style mode | Roleplay | roleplay thread | Visual-novel-style character scenes with cast, continuity, and world context. |
| Chat list/sidebar | Pond | thread list | Saved Messenger and Roleplay records. |
| Character catalog | Companions | character record | People/entities the user can talk with or place into Roleplay threads. |
| Persona catalog | Personas | persona record | User-facing identities for participation in Messenger and Roleplay threads. |
| Lorebook/knowledge catalog | Lorebooks | lorebook record | Reusable facts, setting notes, references, and continuity material. |
| Presets/chat presets | Currents | prompt recipe | Reusable generation settings and prompt structure. |
| Game-state/tracker-style data | Ripples | ripple state | Dynamic per-thread state, counters, summaries, and continuity changes. |
| Tracker sidebar panel | Ripple Dock | ripple dock | Sidebar surface for viewing and editing Ripples. |
| Automation/helper catalog | Keepers | helper module | Optional automated reviewers, trackers, or generators. |
| Connections/providers | Inlets | provider connection | Model, local runtime, and service configuration. |
| Gallery/sprites/assets | Net | media asset | User-owned images, sprites, audio, and generated visual assets. |

## DM-Style Chat Name

Use **Messenger**.

Why:

- It is immediately understandable to nontechnical users.
- It works for both one-on-one and group chats.
- It avoids over-theming the core workflow.
- It lets the saved object still be a **thread**, which is a useful internal noun.

Suggested language:

- Public navigation: `Messenger`
- Primary action: `New thread`
- One-on-one subtype: `Direct Messenger`
- Multi-participant subtype: `Group Messenger`
- Internal kind: `messenger`
- Core record: `MessengerThread`
- Import adapter alias only: `legacy conversation source`

Avoid using `Conversation Mode` as public text or `conversation` as a native
DeKoi mode ID.

Close alternates:

- `Pings`: clear DM meaning, but weaker DeKoi identity.
- `Pondlines`: distinctive, but may be too coined for first-run users.

## Roleplay Name

Use **Roleplay** as the public surface label for visual-novel-style character
scenes.

Suggested language:

- Public navigation: `Roleplay`
- Primary action: `New Roleplay`
- Internal kind: `roleplay`
- Core record: `RoleplayThread`
- Import adapter alias only: `legacy roleplay source`

Avoid using `Roleplay Mode` as public text or `roleplay` as a native DeKoi mode
ID.

## Koi-Theme Candidate Pool

These labels are candidates, not final law. Test them in UI before locking them
into storage schemas.

| Surface | Strong candidate | Softer/clearer alternate | Notes |
| --- | --- | --- | --- |
| Saved thread home | Pond | Threads | `Pond` fits the app identity, but `Threads` is clearer if navigation feels vague. |
| Character library | Companions | Shoal | `Companions` is warm and clear; `Shoal` remains a thematic alternate. |
| User identities | Personas | Reflections | `Personas` is established ecosystem language; `Reflections` is a thematic alternate. |
| Knowledge/lore | Lorebooks | Depth Notes | `Lorebooks` is established ecosystem language; `Depth Notes` is a thematic alternate. |
| Prompt presets | Currents | Recipes | `Currents` suggests response flow; `Recipes` is clearer. |
| Dynamic thread state | Ripples | State | `Ripples` fits changing conditions without saying `game state`. |
| Tracker sidebar panel | Ripple Dock | Ripple Panel | `Ripple Dock` sounds like a side surface without copying `Tracker Sidebar Panel`. |
| Automations | Keepers | Helpers | `Keepers` fits care/maintenance; `Helpers` is plain. |
| Provider connections | Inlets | Connections | `Inlets` suggests outside model input; `Connections` is clearer. |
| Media/assets | Net | Media | `Net` is short and thematic, but may read as internet/network. |

## State/Tracker Name

Use **Ripples** as the candidate public label for dynamic per-thread state.

This covers things that may eventually include:

- character presence or mood
- relationship notes
- counters or meters
- continuity changes
- compact summaries of what shifted in a thread

Suggested language:

- Public surface: `Ripples`
- Sidebar/panel surface: `Ripple Dock`
- Internal noun: `RippleState`
- UI component noun: `RippleDock`
- Single change/event: `Ripple`
- Import adapter alias only: `legacy game-state source` or `legacy tracker source`

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
- `roleplay`
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

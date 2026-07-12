# Mode Impact Map

Use this before touching Messenger, Roleplay, shared generation, or shared
per-thread state.

## Messenger

Owner paths:

- `src/engine/contracts/types/messenger.ts`
- `src/engine/modes/messenger/messenger-actions.ts`
- `src/engine/generation/messenger-generation.ts`
- `src/features/modes/messenger`
- `src/features/runtime/generation/messenger-generation.ts`
- `src/features/runtime/generation/provider-messenger-generation.ts`

Owns:

- Messenger thread records and message turns
- direct/group chat-style display behavior
- Messenger message actions and deterministic mutations
- provider-neutral Messenger generation request assembly
- Messenger-specific send/regenerate behavior

Must not own:

- Roleplay scene lifecycle
- Roleplay cast/world/context setup
- generic ripple state semantics
- storage contracts that should be mode-neutral

## Roleplay

Owner paths:

- `src/engine/contracts/types/roleplay.ts`
- `src/engine/modes/roleplay/roleplay-actions.ts`
- `src/engine/generation/roleplay-generation.ts`
- `src/features/modes/roleplay`
- `src/features/runtime/generation/roleplay-generation.ts`

Owns:

- Roleplay thread records and scene records
- scene create/update/fork-style semantics as they are added
- cast, world, and context setup
- Roleplay-owned thread reference mutations for participants, persona,
  lorebooks, and provider connection
- Roleplay scene display behavior
- Roleplay-specific generation behavior

Must not own:

- Messenger message lifecycle
- Messenger-specific prompt request assembly
- generic ripple state semantics
- storage contracts that should be mode-neutral

## Shared Per-Thread State

Owner paths:

- `src/engine/contracts/types/ripples.ts`
- `src/engine/ripples/ripple-actions.ts`
- `src/engine/contracts/types/macro-variables.ts`
- `src/engine/macro-variables/macro-variable-actions.ts`
- `src/features/runtime/ripples`

Owns:

- dynamic per-thread state records
- deterministic ripple mutations
- global and per-thread macro variable state selection/commit mutations
- shared ripple workflows used by mode surfaces

Must not own:

- Messenger or Roleplay orchestration
- prompt semantics for a concrete mode
- legacy game-state naming as a native product concept

## Shared Lower Layers

Allowed shared homes:

- `src/engine`: native record types, deterministic actions, and pure helpers
  that do not encode concrete mode orchestration.
- `src/engine/shared`: engine-local helpers shared by engine owners without
  importing generic frontend/shared code.
- `src/engine/generation-core`: mode-neutral activation and prompt-selection
  primitives shared by Messenger and Roleplay.
- `src/engine/prompt-presets`: prompt preset normalization and
  provider-message assembly helpers; concrete modes still supply their own
  marker expansions, transcripts, and tail prompts.
- `src/features/modes/shared`: shared mode UI and mode-safe helpers such as
  `ChatComposer` and reference-summary helpers.
- `src/features/runtime/generation/generated-draft-records.ts`: shared
  generation-response draft mapping; callers still provide mode-owned record
  creation and ID prefixes.
- `src/features/runtime/generation`: generation workflows that bind mode-owned
  request builders to provider/runtime transport.
- `src/features/runtime/storage`: storage workflows used by mode and shell
  surfaces.
- `src/runtime`: storage contracts, collection adapters, bundle import/export,
  and legacy import normalization.
- `src/shared`: generic non-product helpers used by feature and runtime code.
- `src/shared/ui`: generic UI atoms.
- `src/shared/api`: typed host and remote-runtime command wrappers.

Shared mode UI/helpers should stay mode-neutral. If a shared component or helper
needs concrete Messenger or Roleplay behavior, pass labels, data, or actions in
from the owning mode surface or move the behavior to the owning mode package.

## Impact Report Questions

For every mode-related change, answer:

- Which mode owns the entry point?
- Which lower layers changed?
- Which sibling modes could observe the shared change?
- What verifies the changed mode?
- What verifies no accidental sibling mode behavior changed?

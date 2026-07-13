# DeKoi Repo Layout

Use this as a quick map. `ARCHITECTURE.md` remains the source of truth for
current source lanes and dependency direction.

Current DeKoi is the source tree being refactored. The previous `C:\De-Koi`
repo is an ownership-shape reference only. Reuse its deeper owner skeleton for
implemented DeKoi behavior, but keep DeKoi product nouns such as Messenger,
Roleplay, Pond, and Ripples. Do not create old repo product lanes such as game,
agents, Deki, gallery, or trackers until this repo actually implements them.

## TypeScript

```text
src/app/
  React app composition, providers, storage sync, top-level state, and view
  action assembly.

src/features/
  React surfaces and workflows. Features render UI, collect user intent, call
  engine helpers, and call feature runtime or shared API wrappers.

src/features/catalog/
  Catalog resources and record action hooks: companions, personas, lorebooks,
  provider connections, and shared catalog UI.

src/features/modes/
  User mode surfaces and mode-specific UI: messenger, roleplay, and shared
  mode-safe UI/helpers such as ChatComposer and reference summaries.

src/features/runtime/
  React-free feature workflows for generation, ripples, and storage.

src/features/navigation/
  Navigation context and contracts. Other features receive narrow navigation
  props instead of importing the full navigation context.

src/features/shell/
  App-level shell and Pond surfaces: care, pond, shoal, tide, waterline, bank,
  currents, depths, pools, and related shell workflows.

src/runtime/
  Frontend storage runtime bridge. Owns storage contracts, collection adapters,
  bundle import/export, app snapshot orchestration, and legacy import
  normalization.

src/shared/
  Generic UI primitives, styling tokens, browser/React helpers, non-product
  utility helpers, and typed API wrappers.

src/shared/api/
  Typed wrappers around desktop Tauri commands and remote-runtime HTTP
  invocation. Feature code may call focused wrappers. Engine code may not.

src/engine/
  React-free product engine. Owns native records, pure actions, prompt/generation
  request assembly, and future capability ports.
```

## Current Engine Files

```text
src/engine/contracts/types/mode-thread.ts
src/engine/modes/mode-thread/mode-thread-actions.ts
src/engine/modes/mode-thread/mode-thread-validation.ts
  Additive shared branch/message/version contracts, strict boundary validation,
  and pure actions for truthful Messenger and Roleplay kinds. Concrete mode
  factories, generation, UI, app state, and storage do not use this substrate
  yet.

src/engine/contracts/types/messenger.ts
src/engine/modes/messenger/messenger-actions.ts
src/engine/generation/messenger-generation.ts
  Messenger thread/message records, mutations, and provider-neutral generation
  request assembly.

src/engine/contracts/types/roleplay.ts
src/engine/modes/roleplay/roleplay-actions.ts
src/engine/generation/roleplay-generation.ts
  Roleplay thread/entry records, mutations, and provider-neutral generation
  request assembly.

src/engine/generation/generation.ts
  Shared provider-neutral generation request and response helpers.

src/engine/prompt-presets/prompt-preset-actions.ts
src/engine/prompt-presets/prompt-preset-normalization.ts
src/engine/prompt-presets/prompt-preset-assembler.ts
src/engine/prompt-presets/starter-preset.ts
  Prompt preset actions, normalization, starter records, and provider-message
  assembly helpers.

src/engine/shared/errors.ts
src/engine/shared/text.ts
  Engine-local shared formatting and string cleanup helpers. Keep behavior
  aligned with matching generic helpers in src/shared without importing across
  the engine boundary.

src/engine/generation-core/lorebook-activation.ts
src/engine/generation-core/lorebook-activation-resolution.ts
src/engine/generation-core/lorebook-activation-types.ts
  Mode-neutral lore activation, inclusion-group resolution, activation types,
  deterministic ordering, and budget helpers.

src/engine/generation-core/macros/macro-engine.ts
src/engine/generation-core/macros/macro-definitions.ts
src/engine/generation-core/macros/macro-catalog.ts
  Mode-neutral prompt macro resolver, active macro definitions, and editor-safe
  supported macro metadata plus scratch resolution helpers for non-committing
  previews.

src/engine/contracts/types/character.ts
src/engine/catalog/character-actions.ts
src/engine/contracts/types/persona.ts
src/engine/catalog/persona-actions.ts
src/engine/contracts/types/lorebook.ts
src/engine/catalog/lorebook-actions.ts
src/engine/contracts/types/provider-connection.ts
src/engine/catalog/provider-connection-actions.ts
  Catalog record contracts and deterministic mutations.

src/engine/contracts/types/ripples.ts
src/engine/ripples/ripple-actions.ts
  Shared per-thread Ripple state contract and deterministic mutations.

src/engine/contracts/types/macro-variables.ts
src/engine/macro-variables/macro-variable-actions.ts
  Shared global and per-thread macro variable state contract and deterministic
  selection/commit mutations.

src/engine/contracts/types/app-settings.ts
src/engine/contracts/types/project-plan.ts
src/engine/contracts/constants/surfaces.ts
  App-level native records, planning records, and surface contracts.
```

Target direction for implemented behavior:

```text
src/engine/contracts       Native record types, schemas, constants.
src/engine/core            IDs, timestamps, result helpers, JSON primitives.
src/engine/shared          Pure deterministic helpers shared by engine owners.
src/engine/generation-core Prompt and provider-neutral generation primitives.
src/engine/generation      Shared generation request/response assembly.
src/engine/modes           Shared mode-thread primitives plus concrete
                           Messenger and Roleplay orchestration.
src/engine/catalog         Character, persona, lorebook, and provider actions.
src/engine/prompt-presets  Prompt preset actions, normalization, and assembly.
src/engine/macro-variables Owner-scoped macro variable state actions.
src/engine/ripples         Ripple behavior and pure actions.
src/engine/capabilities    Future ports only when real adapters need them.
```

## Runtime And Command Boundaries

```text
src/shared/api/desktop-commands.ts
  Desktop Tauri command registry and allowlist. Checked by
  pnpm check:desktop-contracts.

src/shared/api/runtime-commands.ts
  Remote-runtime command registry and allowlist. Checked by
  pnpm check:runtime-contracts.

src/shared/api/desktop-*.ts
  Focused wrappers for desktop host status, provider secrets, file dialogs,
  bundle storage, and desktop runtime invocation.

src/shared/api/remote-runtime-*.ts
  Focused wrappers for remote runtime health, URL handling, HTTP safety, and
  /api/invoke command dispatch.

src/runtime/storage/
  Collection-backed DeKoi storage contracts, repository factory, host storage,
  bundle import/export, and legacy import mapping.
```

## Rust

```text
src-tauri/src/lib.rs
  Tauri setup and command registration.

src-tauri/src/runtime.rs
  Desktop runtime command dispatch glue. Routes provider and storage runtime
  commands to focused Rust capability modules.

src-tauri/src/runtime_args.rs
  Shared JSON runtime command argument helpers.

src-tauri/src/provider_transport.rs
src-tauri/src/provider_transport/
  Desktop provider transport auth, endpoints, HTTP calls, connection checks,
  model listing, and generation payloads.

src-tauri/src/provider_response.rs
  Provider response text extraction and empty-response warning parsing shared by
  the Rust desktop provider path.

src-tauri/src/storage.rs
  App-data collection storage.

src-tauri/src/file_dialog.rs
  Bundle import/export file dialogs.

src-tauri/src/secrets.rs
  Provider secret storage.

src-tauri/src/host.rs
  Desktop host status.
```

Rust owns privileged capability execution. TypeScript owns product meaning.

## Current Flow

```text
feature surface or feature runtime workflow
  -> engine helper for product behavior
  -> runtime bridge or shared API wrapper for persistence/host work
  -> desktop Tauri command or remote-runtime HTTP command
  -> focused Rust module or remote runtime fixture/server
```

Existing broad composition files are not precedent for new product behavior.
Move new logic to the owning mode, runtime workflow, catalog action, engine
record/action, shared API wrapper, or Rust capability module.

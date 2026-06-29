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
  mode UI such as ChatComposer.

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
  Generic UI primitives, styling tokens, browser helpers, React helpers, and
  typed API wrappers.

src/shared/api/
  Typed wrappers around desktop Tauri commands and remote-runtime HTTP
  invocation. Feature code may call focused wrappers. Engine code may not.

src/engine/
  React-free product engine. Owns native records, pure actions, prompt/generation
  request assembly, and future capability ports.
```

## Current Engine Files

```text
src/engine/messenger.ts
src/engine/messenger-actions.ts
src/engine/messenger-generation.ts
  Messenger thread records, mutations, and provider-neutral generation request
  assembly.

src/engine/roleplay.ts
src/engine/roleplay-actions.ts
  Roleplay thread records, scene records, and mutations.

src/engine/character.ts
src/engine/character-actions.ts
src/engine/persona.ts
src/engine/persona-actions.ts
src/engine/lorebook.ts
src/engine/lorebook-actions.ts
src/engine/provider-connection.ts
src/engine/provider-connection-actions.ts
src/engine/ripples.ts
src/engine/ripple-actions.ts
  Catalog/context records and deterministic mutations.

src/engine/app-settings.ts
src/engine/project-plan.ts
src/engine/surfaces.ts
  App-level native records, planning records, and surface contracts.
```

Target direction for implemented behavior:

```text
src/engine/contracts       Native record types, schemas, constants.
src/engine/core            IDs, timestamps, result helpers, JSON primitives.
src/engine/shared          Pure deterministic helpers shared by engine owners.
src/engine/generation-core Prompt and provider-neutral generation primitives.
src/engine/generation      Shared generation request/response assembly.
src/engine/modes           Messenger and Roleplay orchestration.
src/engine/catalog         Character, persona, lorebook, and provider actions.
src/engine/ripples         Ripple records and pure actions.
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
  Desktop runtime command execution.

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

# Architecture Notes

DeKoi should reuse the previous De-Koi architecture shape as a guardrail, not as
a source-copy template. The useful part is the ownership skeleton: product
meaning stays in a React-free engine, UI stays in feature owners, runtime and
host capabilities sit behind narrow adapters, and storage grows from documented
native records instead of accidental feature state.

## Architecture Decision

Use the prior architecture skeleton in DeKoi-owned terms:

- Native product records and behavior are defined before storage details.
- Storage is collection-backed and contract-driven first. A SQL database can
  replace the implementation later only if it preserves the same owned records,
  collection names, relationships, and import/export contract.
- Runtime commands are explicit and allowlisted. Generation, storage, secrets,
  files, and provider transport stay separate.
- Runtime command names are registered in `src/runtime/runtime-commands.ts` and
  checked against the Rust desktop runtime and fixture server.
- Legacy import is a one-way adapter into DeKoi-native records. Legacy names and
  old storage shapes do not become the core model.

## Source Lanes

- `src/engine`: React-free domain records, pure actions, prompt/generation
  request assembly, and future capability ports. Engine code may not import
  React, Tauri, feature internals, or concrete runtime adapters.
- `src/features`: React surfaces and workflows. Feature code renders UI,
  gathers user intent, calls engine helpers for product behavior, and calls
  runtime adapters for persistence or host work.
- `src/runtime`: frontend runtime boundary for this seed. It owns host storage,
  remote runtime, desktop runtime, generation adapters, import/export
  normalization, and Tauri-facing browser code. If it grows, split narrow
  host/API wrappers from product-specific adapter modules.
- `src/shared`: reusable UI primitives, styling tokens, browser-only helpers,
  and other code that is genuinely generic across feature owners.
- `src-tauri`: privileged desktop and hostable capabilities: local files,
  app-data collection storage, provider secrets, native dialogs, and future
  provider transport.

## Dependency Direction

Allowed direction:

```text
features -> engine
features -> runtime
features -> shared
runtime  -> engine types/contracts
runtime  -> Tauri or remote HTTP boundary
shared   -> no feature owners
engine   -> no React, features, runtime, Tauri, or browser APIs
src-tauri -> no TypeScript product imports
```

Stop and redesign if a change needs:

- Engine code importing React, `src/features`, `src/runtime`, or Tauri APIs.
- UI components performing durable storage normalization.
- Feature code calling raw Tauri `invoke` or raw remote `fetch` directly.
- A storage command that also performs generation.
- A generation command that also persists records.
- A compatibility branch that makes old record names native DeKoi concepts.

## Engine Growth Path

The current engine is intentionally flat. Split only when ownership becomes
real:

```text
src/engine/contracts     Native record types, schemas, constants.
src/engine/core          IDs, timestamps, result helpers, JSON primitives.
src/engine/capabilities  Ports for storage, secrets, provider transport, files.
src/engine/entities      Pure record operations for characters, threads, lore.
src/engine/generation    Provider-neutral request/response assembly.
src/engine/modes         Messenger and Classic orchestration.
```

Higher engine layers may use lower ones. Lower layers do not import higher
layers.

## Storage Direction

Durable storage should follow [docs/storage-model.md](./docs/storage-model.md).
The short version:

- Collection names are a contract.
- Each collection has one owner and one native record shape.
- Relationships are stored as IDs and documented with cleanup expectations.
- Import/export validates schema versions and never treats provider secrets as
  ordinary records.
- Native DeKoi records come before legacy compatibility.

## Current Seed

- `src/engine/messenger.ts` and `src/engine/messenger-actions.ts` define native
  Messenger records and mutations.
- `src/engine/classic.ts` and `src/engine/classic-actions.ts` define the first
  Classic scene records.
- `src/engine/character.ts`, `src/engine/persona.ts`,
  `src/engine/lorebook.ts`, `src/engine/provider-connection.ts`, and
  `src/engine/ripples.ts` define the first catalog/context records.
- `src/engine/messenger-generation.ts` builds provider-neutral Messenger
  generation requests.
- `src/features/*` renders Pond, Messenger, Classic, shell, and catalog
  surfaces.
- `src/runtime/*` adapts native records to desktop storage, remote storage,
  DeKoi bundle import/export, and generation runtimes. Runtime command names,
  target URL handling, and health result types have narrow owner modules.
- `src-tauri/src/lib.rs` registers desktop commands. Focused modules under
  `src-tauri/src/` own storage, bundle file dialogs, provider secrets, host
  status, and the desktop runtime bridge.

## Next Architecture Work

1. Move `src/runtime` toward narrower adapter modules before adding real
   provider transport.
2. Add legacy import only after native records and storage contracts are stable.

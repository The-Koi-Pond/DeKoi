# Architecture Notes

DeKoi reuses the ownership skeleton that proved out in the previous project
line: product meaning stays in a React-free engine, UI stays in feature owners,
runtime and host capabilities sit behind narrow adapters, and storage grows
from documented native records instead of accidental feature state. That
skeleton is portable engineering knowledge under
[PROVENANCE.md](./PROVENANCE.md), not copied product code.

This repo's current `src/` is the refactor source. Grow lanes around
implemented DeKoi behavior: do not pre-create old product lanes such as game,
agents, gallery, or trackers until DeKoi actually owns those products, and keep
DeKoi nouns such as Messenger, Roleplay, Pond, and Ripples.

## Architecture Decision

Use the prior architecture skeleton in DeKoi-owned terms:

- Native product records and behavior are defined before storage details.
- Storage is collection-backed and contract-driven first. A SQL database can
  replace the implementation later only if it preserves the same owned records,
  collection names, relationships, and import/export contract.
- Runtime commands are explicit and allowlisted. Generation, storage, secrets,
  files, and provider transport stay separate.
- Runtime command names are registered in `src/shared/api/runtime-commands.ts`
  and checked against the Rust desktop runtime and fixture server.
- Desktop Tauri command names are registered in `src/shared/api/desktop-commands.ts`
  and checked against the Rust command registration.
- Provider secret safety is checked across provider connection records, bundle
  import/export, desktop secret lookup, and editor key handling.
- Legacy import is a one-way adapter into DeKoi-native records. Legacy names and
  old storage shapes do not become the core model.

## Source Lanes

- `src/app`: React bootstrap, providers, app-level state, storage sync, and
  top-level view/action controller assembly. App composition imports feature
  entrypoints and shared helpers; it does not import engine or runtime bridge
  modules directly.
- `src/engine`: React-free domain records, pure actions, prompt/generation
  request assembly, engine-local shared helpers, and future capability ports.
  Engine code may not import React, Tauri, feature internals, or concrete
  runtime adapters.
- `src/features`: React surfaces and workflows. Feature code renders UI,
  gathers user intent, calls engine helpers for product behavior, and uses
  feature-runtime workflows or focused shared API wrappers for persistence or
  host work.
- `src/features/runtime`: React-free feature workflows for generation, Ripples,
  storage startup, runtime target changes, bundle previews, and import/export
  orchestration. This is the only feature layer that adapts the lower
  `src/runtime` bridge.
- `src/features/navigation`: navigation context and nav state/action contracts
  while the seed still uses a single top-level app state provider. It does not
  own concrete feature screens or app provider/controller assembly.
- `src/runtime`: frontend storage boundary for this seed. Its public entrypoint
  exports DeKoi storage contracts, collection adapters, app snapshot
  orchestration, bundle import/export normalization, and legacy import. Host and
  remote transport wrappers live in `src/shared/api`.
- `src/shared`: reusable UI primitives, styling tokens, browser/React helpers,
  generic non-product utilities, and other code that is genuinely generic
  across feature owners.
- `src/shared/api`: typed wrappers around desktop Tauri commands and
  remote-runtime HTTP invocation. Feature code may call focused wrappers or
  feature-runtime workflows. Engine code may not.
- `src-tauri`: privileged desktop and hostable capabilities: local files,
  app-data collection storage, provider secrets, native dialogs, desktop runtime
  dispatch, provider transport, and provider response parsing.

## Dependency Direction

Allowed direction:

```text
app                 -> features, shared
features            -> engine, shared
shell/modes/catalog -> features/runtime for runtime-facing workflows
features/runtime    -> engine, runtime, shared, shared API wrappers
runtime             -> engine types/contracts, shared API wrappers
shared/api          -> Tauri invoke and remote-runtime HTTP wrappers
shared              -> no feature owners, no runtime bridge, no engine imports
engine              -> no React, features, runtime, Tauri, or browser APIs
src-tauri -> no TypeScript product imports
```

Stop and redesign if a change needs:

- Engine code importing React, `src/features`, `src/runtime`, or Tauri APIs.
- UI components performing durable storage normalization.
- Shell, mode, or catalog code importing `src/runtime` directly instead of a
  feature-runtime workflow.
- Feature code calling raw Tauri `invoke`, raw remote `fetch`, or low-level
  desktop/runtime transport directly.
- A storage command that also performs generation.
- A generation command that also persists records.
- A compatibility branch that makes old record names native DeKoi concepts.

## Enforced Boundary Check

Run:

```sh
pnpm check:frontend-boundaries
```

The check enforces the current frontend architecture rules:

- `src/engine` must not import app composition, runtime adapters, feature code,
  shared frontend helpers, React, browser APIs, or Tauri packages.
- `src/app` imports feature entrypoints and shared helpers; it must not import
  engine modules or runtime adapters directly.
- `src/runtime` owns storage/import/export contracts and may import engine
  types/contracts plus shared API wrappers. It must not import app composition,
  feature modules, React, Tauri packages, or desktop command catalogs directly.
- Runtime bridge modules are imported through `src/runtime/index.ts`; runtime
  implementation files stay in owner packages under `src/runtime`.
- Runtime collection adapters use the storage repository factory so host-backed
  storage and future database-backed storage share one swap point.
- Top-level feature folders are `catalog`, `modes`, `navigation`, `runtime`,
  and `shell`.
- Feature layer direction is `shell -> modes -> runtime -> catalog`.
- `src/features/runtime` is the only feature layer that may adapt the lower
  `src/runtime` bridge. Shell, mode, catalog, and navigation modules route
  runtime-facing work through feature-runtime workflows.
- Feature-runtime implementation files live under `generation`, `ripples`, or
  `storage`; feature-runtime workflows stay React-free and do not import
  navigation orchestration.
- `src/features/navigation` is a bridge layer. It must not import sibling shell,
  mode, or catalog UI modules, `src/runtime`, or `src/shared/api` directly.
- Non-navigation feature modules receive navigation state/actions through narrow
  feature-owned props built from exported navigation state/action groups. They
  do not read `useNav()` directly, import `NavContextType`, accept
  `nav: NavContextType`, or pick props from the full navigation type.
- Catalog, modes, navigation, shell, and feature-runtime packages are imported
  through public entrypoints. Package entrypoints use explicit exports, not
  wildcard exports.
- Catalog resource packages and shell packages stay behind their public
  entrypoints as they grow. Catalog source files live in resource or shared
  packages, not directly under `src/features/catalog`.

## Engine Growth Path

The current engine is intentionally flat, but the next architecture step is to
adopt the previous repo's deeper owner skeleton using DeKoi-native names. Split
only around implemented behavior:

```text
src/engine/contracts       Native record types, schemas, constants.
src/engine/core            IDs, timestamps, result helpers, JSON primitives.
src/engine/shared          Pure deterministic helpers shared by engine owners.
src/engine/generation-core Prompt and provider-neutral generation primitives.
src/engine/generation      Shared generation request/response assembly.
src/engine/modes           Shared mode-thread primitives plus concrete
                           Messenger and Roleplay orchestration.
src/engine/catalog         Character, persona, lorebook, and provider actions.
src/engine/prompt-presets  Prompt preset actions, starter preset records,
                            normalization, and section-message assembly.
src/engine/lore-runtime    Pure per-branch lore timer state actions.
src/engine/macro-variables Pure owner-scoped macro variable state actions.
src/engine/ripples         Ripple behavior and pure actions.
src/engine/capabilities    Future ports for storage, secrets, providers, files.
```

Higher engine layers may use lower ones. Lower layers do not import higher
layers. Do not add capability ports until there is a concrete runtime, storage,
provider, or host dependency to abstract.

## Storage Direction

[docs/storage-model.md](./docs/storage-model.md) owns collection names, record
shapes, defaults, repair behavior, and import/export mechanics. The
architecture-level rules:

- Collection names are a contract. Each collection has one owner and one native
  record shape.
- Relationships are stored as IDs and documented with cleanup expectations.
- Provider secrets are never ordinary records and never enter exported bundles.
- Collection adapters depend on `storage-repository-factory.ts`, keeping the
  current host-storage adapter behind one future database swap point.
- Messenger and Roleplay share `mode-threads` metadata and `mode-messages`
  transcript collections; runtime orchestration assembles them before feature
  UI or generation consumes thread objects.
- Native DeKoi records come before legacy compatibility.

## Current Shape

- `src/engine` owns native record contracts under `contracts/types`,
  deterministic catalog/mode/prompt-preset/lore-runtime/macro-variable/ripple actions,
  engine-local shared text/error helpers, and provider-neutral generation
  assembly, including split lorebook matching/activation owners, prompt preset section-message
  assembly, the macro resolver and active editor macro catalog under
  `generation-core`, and Messenger/Roleplay prompt macro wiring under
  `generation`. `contracts/types/mode-thread.ts` and `modes/mode-thread` define
  the validated branch/message/version substrate used by both truthful mode
  kinds. Messenger and Roleplay retain separate factories, actions, prompt
  builders, generation workflows, and screens over one `modeThreads` app-state
  collection and the shared durable collection pair.
- `src/features` renders Pond, Messenger, Roleplay, shell, and catalog
  surfaces. `src/features/runtime` owns runtime-facing workflows grouped under
  `generation`, `ripples`, and `storage`. Non-navigation feature modules
  receive navigation state/actions through narrow feature-owned props rather
  than reading the navigation context directly.
- `src/app/use-app-controller.ts` assembles top-level app state, storage sync,
  and view actions for the app provider.
- `src/runtime/index.ts` is the public runtime bridge. `src/runtime/storage/*`
  adapts native records to desktop or remote storage, DeKoi bundle
  import/export, standalone prompt-preset file conversion, and legacy import
  through shared API wrappers. Pure prompt-preset package normalization and
  serialization remain engine-owned.
- `src-tauri/src/lib.rs` registers desktop commands. Focused modules under
  `src-tauri/src/` own storage, bundle file dialogs, provider secrets, host
  status, desktop runtime dispatch, provider transport, and provider response
  parsing.

The file-level map lives in
`skills/dekoi-architecture-guard/references/repo-layout.md`.

## Future Architecture Work

1. Move remaining flat engine work into the implemented target skeleton:
   `contracts`, `core`, `generation`, `modes`, `catalog`, `macro-variables`,
   and `ripples`.
2. Deepen current feature packages using the previous repo's package pattern:
   public entrypoint, `components`, `hooks`, `lib`, and local `types` when
   needed.
3. Split app storage sync and controller composition after engine and feature
   public paths settle.
4. Normalize `src/runtime/storage` subpackages when storage behavior changes
   again, keeping repository factories as the future database swap point.
5. Add a database-backed storage adapter behind
   `src/runtime/storage/storage-repository-factory.ts` when product needs justify
   replacing the current host-backed implementation.
6. Split navigation contracts toward app or mode-router-owned contracts when a
   concrete route model exists.

## Adding Or Moving Code

1. Put product record types and pure mutations in `src/engine`.
2. Put typed desktop/remote runtime calls in `src/shared/api`.
3. Put storage contracts, collection adapters, app snapshots, bundle
   normalization, and the legacy import bridge in `src/runtime/storage`.
4. Put app-level composition in `src/app`.
5. Put shell tools in `src/features/shell`.
6. Put mode surfaces in `src/features/modes`.
7. Put shared mode-neutral runtime systems in `src/features/runtime`.
8. Put resource data/library owners in `src/features/catalog`.
9. Put privileged local work in `src-tauri`.
10. Put only generic non-product helpers in `src/shared`; keep engine-needed
    copies under `src/engine/shared` so the engine boundary stays React-free and
    host-free.
11. Update this document and `scripts/check-frontend-boundaries.mjs` when a new
    architectural boundary becomes stable enough to enforce.

## Related Checks

- `pnpm check:storage-contracts` keeps TypeScript storage entities and the Rust
  desktop allowlist aligned.
- `pnpm check:provider-secret-safety` keeps provider connection records, bundle
  export/import, desktop secret lookup, and editor key handling from persisting
  API keys as ordinary storage data.
- `pnpm check:runtime-contracts` keeps TypeScript runtime commands, Rust runtime
  dispatch, and the remote fixture aligned.
- `pnpm check:desktop-contracts` keeps desktop command names aligned.
- `pnpm check:frontend-boundaries` keeps frontend import direction aligned.
- `pnpm test` runs fast Vitest unit tests under `src/**/*.test.{ts,tsx}`.

# Architecture Notes

DeKoi should reuse the previous De-Koi architecture shape as a guardrail, not as
a source-copy template. The useful part is the ownership skeleton: product
meaning stays in a React-free engine, UI stays in feature owners, runtime and
host capabilities sit behind narrow adapters, and storage grows from documented
native records instead of accidental feature state.

This repo's current `src/` is the refactor source. The previous `C:\De-Koi`
tree is only a reference for how mature owners are split. Follow the parts of
that shape that match implemented DeKoi behavior; do not create old De-Koi
product lanes such as game, agents, Deki, gallery, or trackers until DeKoi
actually owns those products. Keep current DeKoi nouns such as Messenger,
Roleplay, Pond, and Ripples instead of importing old names or UI copy.

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
  request assembly, and future capability ports. Engine code may not import
  React, Tauri, feature internals, or concrete runtime adapters.
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
- `src/shared`: reusable UI primitives, styling tokens, browser-only helpers,
  and other code that is genuinely generic across feature owners.
- `src/shared/api`: typed wrappers around desktop Tauri commands and
  remote-runtime HTTP invocation. Feature code may call focused wrappers or
  feature-runtime workflows. Engine code may not.
- `src-tauri`: privileged desktop and hostable capabilities: local files,
  app-data collection storage, provider secrets, native dialogs, desktop runtime
  dispatch, and provider transport.

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
src/engine/modes           Messenger and Roleplay orchestration.
src/engine/catalog         Character, persona, lorebook, and provider actions.
src/engine/ripples         Ripple behavior and pure actions.
src/engine/capabilities    Future ports for storage, secrets, providers, files.
```

Higher engine layers may use lower ones. Lower layers do not import higher
layers. Do not add capability ports until there is a concrete runtime, storage,
provider, or host dependency to abstract.

## Shape Trajectory

Current DeKoi already has the top-level lanes. The refactor work is to deepen
them in place:

| Current owner | Current shape | Target trajectory |
| --- | --- | --- |
| Engine | Native records live under `src/engine/contracts`, generation request assembly under `src/engine/generation`, Messenger/Roleplay actions under `src/engine/modes`, catalog actions under `src/engine/catalog`, and Ripple actions under `src/engine/ripples`. | Move future generic primitives to `engine/core` and shared pure helpers to `engine/shared` when they have real consumers. |
| Feature modes | `features/modes/messenger` and `features/modes/roleplay` own thread screens, mode-local `hooks`, mode-local `lib`, and shared mode-safe UI/helpers such as `ChatComposer` and reference-summary helpers. | Keep DeKoi mode names, then continue splitting packages into `components`, `hooks`, `lib`, and public `index.ts` as they grow. |
| Feature catalog | Resource surfaces plus shared action hooks. | Keep resource-owned packages and move pure view-model helpers into local `lib` folders before extracting generic shared UI. |
| Feature runtime | React-free generation, ripple, and storage workflows. | Keep it as the only feature layer that adapts lower `src/runtime` for shell, modes, catalog, and app composition. |
| App | Provider/controller/storage sync hooks at app root. | Split app storage sync and app controller composition into app-owned subpackages after engine/feature public paths settle. |
| Runtime | `src/runtime/storage` bridge with collections and bundles. | Keep storage/import/export here; deepen into repository, snapshots, repair, bundles, and legacy-import subpackages when those concerns change. |
| Shared API | Focused desktop and remote wrappers. | Keep all raw Tauri and remote-runtime transport here; features call focused wrappers or feature-runtime workflows. |

## Storage Direction

Durable storage should follow [docs/storage-model.md](./docs/storage-model.md).
The short version:

- Collection names are a contract.
- Each collection has one owner and one native record shape.
- Relationships are stored as IDs and documented with cleanup expectations.
- Import/export validates schema versions and never treats provider secrets as
  ordinary records.
- Lorebook records currently use a DeKoi-native `schemaVersion: 2` foundation;
  pre-v2 lorebook rows were development-only and are rejected rather than
  migrated.
- Provider connection records store metadata only; desktop provider secrets are
  scoped to the connection provider and base URL.
- Collection adapters depend on `storage-repository-factory.ts`, keeping the
  current host-storage adapter behind one future database swap point.
- Messenger and Roleplay transcripts are separate storage collections from
  thread metadata; runtime orchestration assembles them before feature UI or
  generation consumes thread objects.
- App storage sync tracks dirty collections and serializes collection-level
  replacements so the same collection does not have overlapping writes.
- Desktop collection metadata is used only for explicit stale checks and manual
  reloads; external file edits are not hot-loaded or merged into memory.
- Bundle and legacy imports use an explicit backup-and-commit path that cancels
  delayed autosave before replacing collections.
- Desktop collection files report recoverable corruption/recovery-artifact
  states and block autosave overwrite; Pond Care can perform explicit confirmed
  single-collection desktop repair through dedicated Tauri commands.
- Native DeKoi records come before legacy compatibility.

## Current Shape

- `src/engine/contracts/types/messenger.ts` defines native Messenger thread and
  message records. `src/engine/modes/messenger/messenger-actions.ts` owns
  Messenger mutations.
- `src/engine/contracts/types/roleplay.ts` defines native Roleplay thread and
  entry records. `src/engine/modes/roleplay/roleplay-actions.ts` owns Roleplay
  mutations.
- `src/engine/contracts/types/character.ts`,
  `src/engine/contracts/types/persona.ts`,
  `src/engine/contracts/types/lorebook.ts`,
  `src/engine/contracts/types/ripples.ts`,
  `src/engine/contracts/types/app-settings.ts`, and
  `src/engine/contracts/types/project-plan.ts` define the first catalog/context
  and app-level record contracts. `src/engine/contracts/constants/surfaces.ts`
  defines the surface IDs and metadata. `src/engine/contracts/types/provider-connection.ts`
  still owns the provider connection record plus provider helpers until that
  mixed module is split. The lorebook contract is the first catalog record at
  `schemaVersion: 2`; it stores activation, placement, trigger, filter, and
  budget fields. `src/engine/generation-core/lorebook-activation.ts` owns
  lore activation, deterministic insertion ordering, and approximate lore
  budget trimming. `src/engine/generation/generation.ts` owns shared lore
  formatting and at-depth insertion helpers used by Messenger and Roleplay.
  Recursion, probability, triggers, and character/match-source filters remain
  future behavior.
- `src/engine/catalog/character-actions.ts`,
  `src/engine/catalog/persona-actions.ts`,
  `src/engine/catalog/lorebook-actions.ts`, and
  `src/engine/catalog/provider-connection-actions.ts` own deterministic catalog
  record mutations.
- `src/engine/ripples/ripple-actions.ts` owns deterministic shared per-thread
  Ripple state mutations.
- `src/engine/generation/generation.ts`,
  `src/engine/generation/messenger-generation.ts`, and
  `src/engine/generation/roleplay-generation.ts` build shared, Messenger, and
  Roleplay provider-neutral generation requests, including activated lorebook
  context for selected Messenger or Roleplay lorebooks.
- `src/features/*` renders Pond, Messenger, Roleplay, shell, and catalog
  surfaces. `src/app/use-app-controller.ts` assembles the top-level navigation
  controller for the app provider, including top-level app state, storage sync,
  and view actions. `src/features/navigation` owns only the navigation context
  and nav contracts while the seed still uses a single top-level app state
  provider.
  Catalog owns catalog record action hooks, modes own thread action hooks under
  their mode-local `hooks` folders, and
  shell care owns settings/import/export action hooks. `src/features/runtime`
  owns runtime-facing workflows grouped under `generation`, `ripples`, and
  `storage`, including generation, ripple state operations, initial app-storage
  record loading, explicit storage stale checks and reloads, and runtime target
  URL changes.
  Non-navigation feature modules receive navigation state/actions through narrow
  feature-owned props built from exported navigation state/action groups rather
  than reading navigation context directly, importing `NavContextType`, or
  deriving feature props from the full navigation type.
- `src/runtime/index.ts` is the public runtime bridge. `src/runtime/storage/*`
  adapts native records to desktop or remote storage, DeKoi bundle
  import/export, and legacy import while using shared API wrappers for host or
  remote transport.
- `src-tauri/src/lib.rs` registers desktop commands. Focused modules under
  `src-tauri/src/` own storage, bundle file dialogs, provider secrets, host
  status, desktop runtime dispatch, and provider transport.

## Future Architecture Work

1. Move remaining flat engine work into the implemented target skeleton:
   `contracts`, `core`, `generation`, `modes`, `catalog`, and `ripples`.
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
10. Put only generic helpers in `src/shared`.
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

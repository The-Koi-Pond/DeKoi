# Architecture Guardrails

DeKoi's target architecture follows the old De-Koi skeleton because that shape
is project-agnostic and keeps ownership visible: app composition, layered React
features, shared runtime APIs, a React-free product engine, and native host
capabilities stay separate.

The current repo is still migrating toward that shape. Treat `src/runtime` and
`src/features/navigation` as bridge layers, not as the final architecture.

## Target Source Shape

```text
src/app/
  React bootstrap, providers, startup effects, and app-level composition.

src/features/catalog/
  Resource/data owners: companions, personas, lorebooks, provider connections,
  thread libraries, presets, galleries, and importable product collections.

src/features/runtime/
  React-free frontend runtime workflows used by app, shell, and modes:
  generation flow, ripples, storage startup, runtime target changes, bundle
  previews, and import/export orchestration.

src/features/modes/
  Concrete user mode surfaces and their shared mode UI: Messenger, Roleplay,
  shared mode UI, and future approved mode surfaces.

src/features/shell/
  App-level tools and panels: Pond shell, care/settings, data backup,
  provider setup, navigation chrome, and desktop integration UI.

src/shared/
  Generic frontend helpers, browser utilities, primitives, and UI components.

src/shared/api/
  Typed runtime wrappers around desktop Tauri commands and remote runtime HTTP.
  Feature code may call these wrappers. Engine code may not.

src/engine/
  React-free product records, pure actions, selectors, generation contracts,
  and capability ports.

src-tauri/
  Native capabilities, local storage, secrets, command dispatch, and remote
  runtime/provider transport behavior.
```

## Current Bridge Map

| Layer | Path | Owns | Must not own |
| --- | --- | --- | --- |
| App composition | `src/app`, `src/main.tsx` | Provider wiring, app state/storage/view controller assembly, and first render composition. | Product rules, storage adapters, or host I/O. |
| Product engine | `src/engine` | React-free records, actions, selectors, and product rules. | React, browser/UI helpers, runtime adapters, feature UI, or host clients. |
| Runtime adapter bridge | `src/runtime` | Public runtime entrypoint plus the `src/runtime/storage` package for storage contracts, collection adapters, app snapshot orchestration, bundle import/export normalization, and legacy import. | React features, UI orchestration, generation orchestration, or raw desktop/remote transport. |
| Navigation bridge | `src/features/navigation` | Navigation context and nav state/action contracts until mode router boundaries exist. | State/storage/view hooks, runtime/ripple actions, concrete feature screens, shell UI, or app provider/controller assembly. |
| Feature UI bridge | None currently. New top-level feature folders should not be added without updating this doc and `scripts/check-frontend-boundaries.mjs`. | User workflows, screens, local presentation state, and component composition inside existing owners. | Durable data schemas, DB clients, host I/O, or duplicated engine rules. |
| Shared helpers | `src/shared` | Generic browser and UI utilities that do not know concrete DeKoi feature ownership. | App features or feature-specific product workflows. |
| Desktop host | `src-tauri` | Native capabilities, local filesystem storage, secrets, and runtime command dispatch. | React UI concerns or TypeScript product rules. |

## Enforced Import Boundaries

Run:

```sh
pnpm check:frontend-boundaries
```

The check currently enforces these rules:

- `src/engine` must not import `src/runtime`, `src/features`, `src/shared`,
  `src/app`, React, or Tauri packages.
- `src/app` must not import runtime adapters or engine modules directly.
- `src/runtime` must not import `src/app`, `src/features`, React, Tauri
  packages, or the desktop command catalog directly.
- `src/runtime` bridge modules must be imported through the runtime public
  entrypoint.
- Runtime implementation files must live in owner packages under `src/runtime`,
  leaving `src/runtime/index.ts` as the public entrypoint.
- Runtime storage collection adapters must use the storage repository factory;
  direct host-storage imports stay behind that factory so a future database
  adapter has one swap point.
- Feature runtime implementation files must live in owner packages under
  `src/features/runtime`: `generation`, `ripples`, or `storage`; only
  `src/features/runtime/index.ts` stays at the feature-runtime root.
- Navigation bridge implementation files must live in `context` under
  `src/features/navigation`; only the package entrypoint stays at the
  navigation root. State, action, and runtime hooks must live with app or
  feature owners.
- `src/shared` must not import `src/app` or `src/features`; generic shared code
  outside `src/shared/api` also must not import engine or runtime adapter
  modules.
- `src/shared/api` must not import the `src/runtime` bridge.
- `src/features/navigation` must route host and runtime API wrapper calls
  through `src/features/runtime`.
- App composition must be imported through its public entrypoint.
- Top-level feature folders must be `catalog`, `modes`, `navigation`, or
  `shell`.
- If old-shape feature layer folders exist, their direction is
  `shell -> modes -> runtime -> catalog`.
- Catalog must be imported through its public entrypoint.
- Catalog resource packages must be imported through their public entrypoints.
- Catalog source files must live in resource or shared packages, not directly
  under `src/features/catalog`.
- Feature runtime must be imported through its public entrypoint.
- Modes must be imported through their public entrypoint.
- Mode packages must be imported through their public entrypoints.
- Navigation must be imported through its public entrypoint.
- Shell must be imported through its public entrypoint.
- Shell packages must be imported through their public entrypoints.
- Non-navigation feature modules must receive navigation state/actions through
  narrow feature-owned props built from exported navigation state/action groups
  instead of reading `useNav()` directly, importing `NavContextType`, accepting
  `nav: NavContextType`, or picking from `NavContextType`.
- Feature package entrypoints must use explicit exports, not wildcard exports.
- `src/features/navigation` must not import sibling shell, mode, or catalog UI
  modules. It may call lower `features/runtime` workflows while navigation is a
  bridge layer, and it must not import `src/runtime` or `src/shared/api`
  directly.
- `src/features/runtime` is the only feature layer that may adapt the remaining
  `src/runtime` bridge. Shell, mode, and catalog modules must not import
  `src/runtime` directly.
- `src/features/runtime` workflows must stay React-free and must not import
  navigation orchestration.

The feature-runtime exception exists only while storage and import/export
adapters still live under `src/runtime`. Do not route shell or mode UI around
`features/runtime` for new runtime-facing work.

## Migration Direction

Move toward the old De-Koi skeleton in small, validated slices:

1. Keep provider/startup composition in `src/app`; root entry files should stay
   thin and import app composition through the app package entrypoint.
2. Keep app provider wiring plus top-level state, storage sync, and view
   controller assembly in `src/app`. Catalog owns catalog record actions,
   modes own thread actions, shell care owns settings/import/export actions,
   and feature-runtime owns ripple/runtime actions. Import navigation through
   its package entrypoint while it remains a context/contracts bridge.
3. Keep Messenger and Roleplay screens under `features/modes`; move future mode
   surfaces there too, with a feature entrypoint plus package entrypoints for
   each mode.
4. Keep Pond shell, care drawer, shoal, tide, bank, and waterline under
   `features/shell`; move future app-level tools there too. Import the shell
   feature through its package entrypoint from app composition.
5. Pass navigation state/actions through narrow feature-owned props into shell,
   mode, and catalog surfaces. Build those contracts from exported navigation
   state/action groups rather than reading the navigation context, importing
   `NavContextType`, accepting it directly, or picking from it inside
   non-navigation feature modules.
6. Keep desktop/remote transport, desktop bundle file/storage command wrappers,
   desktop host status, and provider secret wrappers in `src/shared/api`;
   keep DeKoi storage contracts, collection adapters, and bundle normalization
   organized under `src/runtime/storage`. Import
   feature runtime workflows through their package entrypoint from outside the
   package, keep feature-runtime implementation files under `storage`,
   `generation`, or `ripples`, and import the lower runtime bridge through its
   public entrypoint. App composition should use feature-runtime workflows for
   storage startup and runtime target changes. Shell UI should use
   feature-runtime workflows for storage bundle file previews rather than
   calling raw bundle normalizers directly.
7. Keep `features/catalog` organized as resource-owned packages with public
   entrypoints as collections grow. Import catalog surfaces through the catalog
   feature entrypoint from outside the catalog feature.
8. Keep shell packages behind public entrypoints as they grow.
9. Add stricter private-folder and public-entrypoint checks once those packages
   exist.

## Storage And DB Direction

Storage owns persistence mechanics. Engine owns product meaning.

- Durable record names and shapes stay DeKoi-native.
- Runtime/shared API modules normalize JSON, call desktop/remote storage, and
  hide future SQLite or database implementation details.
- Runtime collection adapters depend on the storage repository factory, not the
  host-storage adapter directly.
- Messenger and Roleplay transcript items are stored separately from thread
  metadata, then assembled by runtime orchestration before feature UI or
  generation consumes thread objects.
- App storage sync tracks dirty collections and serializes collection-level
  replacements so the same collection does not have overlapping writes.
- Desktop collection metadata is used for explicit stale checks and manual
  reloads only; external file edits are not hot-loaded or merged into memory.
- Bundle and legacy imports use an explicit backup-and-commit path that cancels
  delayed autosave before replacing collections.
- Desktop collection files report recoverable corruption/recovery-artifact
  states and block autosave overwrite; Rust-only helpers can perform explicit
  confirmed repair, but no Tauri command or UI path is registered yet.
- Engine modules define records and mutations without knowing how records are
  stored.
- App/runtime orchestration loads, syncs, imports, exports, and exposes typed
  actions to the UI.
- Feature UI consumes navigation state/actions or narrowly typed props. It
  should not learn DB tables, host commands, or storage file layout.
- Future DB adapters should implement runtime repository/storage functions
  behind the existing factory/contracts, not leak clients into features,
  collection adapters, or engine code.

## UI State Conventions

Edit surfaces should make pending edits visible without adding explanatory text.

- Primary save actions such as `Save Changes` stay present in the same location
  when a surface is clean, but use a darker, quieter, lower-emphasis state.
- When local edits differ from the last saved record, the primary save action
  should light up with the surface accent and a restrained glow.
- Dirty-state comparisons should use normalized draft values where the save path
  normalizes them, so whitespace-only differences do not create false pending
  states.

## Adding Or Moving Code

1. Put product record types and pure mutations in `src/engine`.
2. Put typed desktop/remote runtime calls in `src/shared/api`; use
   `src/runtime/storage` for storage contracts, collection adapters, app
   snapshots, bundle normalization, and legacy import bridge code.
3. Put app-level composition in `src/app`.
4. Put shell tools in `src/features/shell`.
5. Put mode surfaces in `src/features/modes`.
6. Put shared mode-neutral runtime systems in `src/features/runtime`.
7. Put resource data/library owners in `src/features/catalog`.
8. Put privileged local work in `src-tauri`.
9. Put only generic helpers in `src/shared`.
10. Update this document and `scripts/check-frontend-boundaries.mjs` when a new
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

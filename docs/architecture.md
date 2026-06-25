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
  Shared frontend runtime systems used by shell and modes: generation flow,
  ripples, visuals, trackers, and mode-neutral live state.

src/features/modes/
  Concrete user mode surfaces and their shared mode UI: Messenger, Classic,
  future adventure/gameplay modes, and the mode router/composition point.

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
  runtime host behavior.
```

## Current Bridge Map

| Layer | Path | Owns | Must not own |
| --- | --- | --- | --- |
| App composition | `src/app`, `src/main.tsx` | Provider wiring and first render composition. | Product rules, storage adapters, or host I/O. |
| Product engine | `src/engine` | React-free records, actions, selectors, and product rules. | React, browser/UI helpers, runtime adapters, feature UI, or host clients. |
| Runtime adapter bridge | `src/runtime` | Storage contracts, import/export normalization, app settings storage, and remaining migration bridge code until systems move toward `src/shared/api` or `features/runtime`. | React features, UI orchestration, generation orchestration, or raw desktop/remote transport. |
| Navigation bridge | `src/features/navigation` | App state, persistence sync, user action hooks, import/export actions, navigation context, and the navigation controller until mode router boundaries exist. | Concrete feature screens, shell UI, or app provider wiring. |
| Feature UI bridge | None currently. New feature folders must enter `catalog`, `modes`, `navigation`, or `shell`. | User workflows, screens, local presentation state, and component composition. | Durable data schemas, DB clients, host I/O, or duplicated engine rules. |
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
- `src/shared` must not import `src/app` or `src/features`; generic shared code
  outside `src/shared/api` also must not import engine or runtime adapter
  modules.
- `src/shared/api` must not import the `src/runtime` bridge.
- Top-level feature folders must be `catalog`, `modes`, `navigation`, or
  `shell`.
- If old-shape feature layer folders exist, their direction is
  `shell -> modes -> runtime -> catalog`.
- Catalog resource packages must be imported through their public entrypoints.
- Catalog source files must live in resource or shared packages, not directly
  under `src/features/catalog`.
- `src/features/navigation` must not import sibling shell, mode, or catalog UI
  modules. It may call lower `features/runtime` workflows while navigation is a
  bridge layer, and it must not import `src/runtime` directly.
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
   thin.
2. Keep app provider wiring in `src/app`; move the remaining navigation
   controller/state bridge toward app or mode router ownership as those
   boundaries become concrete.
3. Keep Messenger and Classic screens under `features/modes`; move future mode
   surfaces there too.
4. Keep Pond shell, care drawer, shoal, tide, bank, and waterline under
   `features/shell`; move future app-level tools there too.
5. Keep desktop/remote transport, desktop bundle file/storage command wrappers,
   desktop host status, and provider secret wrappers in `src/shared/api`;
   continue moving remaining `src/runtime` storage and import/export systems
   toward `src/shared/api` or `features/runtime` where appropriate.
6. Keep `features/catalog` organized as resource-owned packages with public
   entrypoints as collections grow.
7. Add stricter private-folder and public-entrypoint checks once those packages
   exist.

## Storage And DB Direction

Storage owns persistence mechanics. Engine owns product meaning.

- Durable record names and shapes stay DeKoi-native.
- Runtime/shared API modules normalize JSON, call desktop/remote storage, and
  hide future SQLite or database implementation details.
- Engine modules define records and mutations without knowing how records are
  stored.
- App/runtime orchestration loads, syncs, imports, exports, and exposes typed
  actions to the UI.
- Feature UI consumes navigation state/actions or narrowly typed props. It
  should not learn DB tables, host commands, or storage file layout.
- Future DB adapters should implement runtime repository/storage functions
  behind the existing contracts, not leak clients into features or engine code.

## Adding Or Moving Code

1. Put product record types and pure mutations in `src/engine`.
2. Put typed desktop/remote runtime calls in `src/shared/api`; use current
   `src/runtime` only for remaining storage and import/export migration bridge
   code.
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
- `pnpm check:runtime-contracts` keeps TypeScript runtime commands, Rust runtime
  dispatch, and the remote fixture aligned.
- `pnpm check:desktop-contracts` keeps desktop command names aligned.
- `pnpm check:frontend-boundaries` keeps frontend import direction aligned.

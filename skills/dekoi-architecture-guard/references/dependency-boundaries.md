# Dependency Boundaries

Use this reference when deciding where a fix belongs or whether an import is
valid.

## Import Direction

Allowed:

- Features may import `src/engine` and `src/shared`.
- `src/features/runtime` may import the lower `src/runtime` bridge. Shell,
  modes, catalog, and navigation code route runtime-facing work through
  `src/features/runtime` workflows instead of importing `src/runtime` directly.
- Feature layer direction follows the current boundary check: shell can compose
  modes/runtime/catalog; modes can use runtime/catalog; runtime can use catalog.
- Same-layer feature packages import each other only through public owner APIs.
- Cross-package feature imports use curated public entry files such as
  `index.ts`, `types.ts`, or owner-specific public files.
- Feature runtime workflows may import engine helpers, runtime bridge APIs, and
  shared API wrappers, but should stay React-free.
- Runtime bridge code may import engine types/contracts and shared API wrappers.
- Shared API wrappers may import Tauri invoke helpers, remote-runtime HTTP
  helpers, and command DTOs.
- Rust command modules may call focused Rust capability modules.

Forbidden:

- `src/engine/**` importing React, browser APIs, `@tauri-apps/api`,
  `src/app/**`, `src/features/**`, `src/runtime/**`, or `src/shared/**`.
- `src/app/**` importing `src/runtime/**` or `src/engine/**` directly.
- `src/runtime/**` importing React, Tauri packages, `src/app/**`, or
  `src/features/**`.
- `src/shared/**` importing `src/app/**` or `src/features/**`.
- Generic `src/shared/**` importing `src/runtime/**` or `src/engine/**`.
- `src/shared/api/**` importing `src/runtime/**`.
- `src/features/navigation/**` importing `src/shared/api/**`.
- `src/features/runtime/**` importing React.
- Shell, mode, catalog, or navigation code importing `src/runtime/**` directly.
- `src/features/catalog/**` importing higher feature layers.
- Concrete mode packages importing each other directly:
  `src/features/modes/messenger` and `src/features/modes/roleplay` compose only
  through public mode entrypoints and shared mode UI.
- `src/features/modes/shared/**` importing concrete mode packages.
- Feature code importing another package's private components, hooks, stores,
  state, lib, or API folders.
- Feature code importing `@tauri-apps/api`, `src/shared/api/desktop-runtime`, or
  `src/shared/api/remote-runtime-invoke` directly instead of a focused wrapper
  or feature runtime workflow.
- Rust code depending on TypeScript product concepts beyond opaque DTO shapes.

## Placement Questions

Ask these before adding a file:

1. Does it render UI? Put it in `src/features` or `src/shared/ui`.
2. Does it coordinate app-shell workflows? Put it in `src/app` or
   `src/features/shell`.
3. Does it coordinate concrete mode UI? Put it in
   `src/features/modes/messenger` or `src/features/modes/roleplay`.
4. Is it shared mode UI? Put it in `src/features/modes/shared`.
5. Is it a React-free workflow used by modes or shell? Put it in
   `src/features/runtime`.
6. Is it catalog data, record actions, or a library surface? Put it in
   `src/features/catalog`.
7. Does it coordinate product behavior or mutate native records? Put it in
   `src/engine`.
8. Does it own storage contracts, collection adapters, bundle import/export, or
   legacy import? Put it in `src/runtime`.
9. Does it perform privileged local work? Put it in `src-tauri` and expose a
   narrow command.
10. Is it a runtime wrapper for embedded Tauri or remote-runtime HTTP? Put it in
   `src/shared/api`.
11. Is it pure and reused by multiple modes? Put it in a mode-neutral engine
   helper only if it does not encode mode orchestration.

## File Splitting

Split when a file mixes any two of these without a strong reason:

- UI rendering
- storage persistence
- provider transport
- prompt assembly
- mode orchestration
- Tauri command registration
- filesystem/path safety
- import/export parsing
- navigation composition

Prefer one module per responsibility. A large owner module can expose a small
public function while implementation details live in sibling files.

## Public Entrypoints

Avoid barrels whose only purpose is convenience or legacy compatibility. If a
public API is needed, create an owner file that contains real behavior, types,
or a curated facade. Public feature entrypoints should make ownership clear.

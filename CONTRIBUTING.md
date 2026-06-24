# Contributing To DeKoi

Thanks for helping with DeKoi. This repository is a clean-room, from-scratch project, so contribution hygiene matters as much as code quality.

## Clean-Room Rule

Do not copy from the prior fork-derived line:

- Source code.
- Assets.
- Documentation wording.
- Prompts.
- UI text.
- Storage schemas.
- Component layouts.
- Generated bindings.
- Config files beyond generic tool defaults.

Allowed inputs include DeKoi-owned requirements, general engineering knowledge, public framework documentation, original code written for this repository, and compatibility notes expressed as behavior instead of implementation.

See [CLEAN_ROOM.md](./CLEAN_ROOM.md) for the full boundary.

## Before Substantial Changes

Write the DeKoi requirement first. The requirement should explain what the app needs in DeKoi terms without referencing how another project implemented it.

For compatibility work, keep the direction one-way:

~~~text
legacy source record -> DeKoi native record
~~~

Import adapters may understand old source shapes. Core DeKoi records, collection names, UI labels, and provider requests should stay DeKoi-native.

## Source Lanes

Follow the ownership boundaries in [ARCHITECTURE.md](./ARCHITECTURE.md):

- src/engine owns React-free domain records and pure product behavior.
- src/features owns React surfaces and workflows.
- src/runtime owns frontend runtime boundaries, storage adapters, import/export normalization, generation adapters, and Tauri-facing browser code.
- src/shared owns generic UI primitives, styling tokens, and browser-only helpers.
- src-tauri owns privileged desktop and hostable capabilities.

Stop and redesign if engine code needs React, feature internals, runtime adapters, Tauri APIs, or browser APIs.

## Checks

Run the full gate before proposing changes:

~~~sh
pnpm check
~~~

Use focused checks when changing a narrow contract:

~~~sh
pnpm check:storage-contracts
pnpm check:runtime-contracts
pnpm check:rust
~~~

## License

Contributions are accepted under the [Apache License 2.0](./LICENSE) unless a maintainer agrees otherwise in writing. Do not add third-party code or assets unless their license is compatible and the provenance is clear.

# Contributing To DeKoi

Thanks for helping with DeKoi. This repository is a from-scratch project, so
contribution hygiene matters as much as code quality.

## Project Provenance

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
- src/runtime owns frontend storage adapters, import/export normalization, and remaining migration bridge code.
- src/shared owns generic UI primitives, styling tokens, and browser-only helpers.
- src-tauri owns privileged desktop and hostable capabilities.

Stop and redesign if engine code needs React, feature internals, runtime adapters, Tauri APIs, or browser APIs.

## Checks

Run focused checks while developing and the full gate before shipping or handing
off a ready PR:

~~~sh
pnpm check
~~~

Use focused checks when changing a narrow contract or pure behavior:

~~~sh
pnpm test
pnpm check:storage-contracts
pnpm check:provider-secret-safety
pnpm check:runtime-contracts
pnpm check:desktop-contracts
pnpm check:frontend-boundaries
pnpm check:bunny-review
pnpm check:rust
~~~

See [AGENTS.md](./AGENTS.md) for the agent-facing workflow map and validation
lane list.

## License

Contributions are accepted under the [Apache License 2.0](./LICENSE) unless a maintainer agrees otherwise in writing. Do not add third-party code or assets unless their license is compatible and the provenance is clear.

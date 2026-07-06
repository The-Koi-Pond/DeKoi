# Contributing To DeKoi

Thanks for helping with DeKoi. This repository is a from-scratch project, so
contribution hygiene matters as much as code quality.

## Provenance

[PROVENANCE.md](./PROVENANCE.md) is the authoritative boundary. The short
version: no AGPLv3/Marinara-derived code, assets, prompts, schemas, UI text,
layouts, or generated bindings; team-authored engineering knowledge and
original team code are portable with attribution; legacy compatibility is
one-way import into DeKoi-native records.

Allowed inputs include DeKoi-owned requirements, general engineering knowledge, public framework documentation, original code written for this repository, and compatibility notes expressed as behavior instead of implementation.

## Before Substantial Changes

Write the DeKoi requirement first. The requirement should explain what the app needs in DeKoi terms without referencing how another project implemented it.

## Source Lanes

Follow the ownership boundaries in [ARCHITECTURE.md](./ARCHITECTURE.md):

- src/engine owns React-free domain records and pure product behavior.
- src/features owns React surfaces and workflows.
- src/runtime owns frontend storage adapters, import/export normalization, and remaining migration bridge code.
- src/shared owns generic UI primitives, styling tokens, browser/React helpers, and non-product utility helpers.
- src-tauri owns privileged desktop and hostable capabilities.

Stop and redesign if engine code needs React, feature internals, runtime adapters, Tauri APIs, or browser APIs.

## Checks

Run the full gate before shipping or handing off a ready PR:

```sh
pnpm check
```

While developing, run the focused check that matches the change. The
change-to-command map lives in [AGENTS.md](./AGENTS.md) under Validation.

## License

Contributions are accepted under the [Apache License 2.0](./LICENSE) unless a maintainer agrees otherwise in writing. Do not add third-party code or assets unless their license is compatible and the provenance is clear.

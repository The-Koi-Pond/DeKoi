# DeKoi

DeKoi is a fresh local-first story and character engine seed.

This repository starts the new DeKoi identity from a blank implementation. It is
not a continuation repository, not a fork checkout, and not a place to copy code,
assets, docs, prompts, schemas, or UI text from the prior fork-derived line.

## Current Scope

- Fresh React and TypeScript app shell.
- Clean-room project boundary notes.
- Early product and architecture notes.
- No durable legacy importer yet.
- No copied source or assets from the prior repo.

## Run

```sh
pnpm install
pnpm dev
```

## Build Check

```sh
pnpm build
```

## Desktop Host

DeKoi has an optional Tauri desktop host scaffold. Use it only for native host
capabilities such as file-backed storage, secrets, filesystem import/export, and
local runtime support.

```sh
pnpm tauri:dev
```

The host currently exposes `dekoi_host_status`,
`dekoi_storage_read_bundle`, `dekoi_storage_write_bundle`, native bundle file
dialogs, provider-key secret commands, and a desktop runtime bridge. Pond Care >
Deep Water can check host readiness, save/load a DeKoi-native bundle through the
desktop app data directory, and select `desktop://runtime` for host-backed
Messenger storage plus fixture generation. Pond Care > Stocking can
export/import bundle files through desktop dialogs. Pond Care > Catalog can
save, check, and clear provider keys for connections without exporting the
secret value.

## Repository Rules

- DeKoi-owned code starts here.
- Legacy compatibility must be built as explicit import adapters.
- Do not use the old repository as a source template.
- If a behavior is needed, write the requirement in DeKoi terms first.
- If a file, phrase, asset, schema, prompt, or component came from the old line,
  it does not belong here.

See [CLEAN_ROOM.md](./CLEAN_ROOM.md) for the boundary process.
See [SURFACE_LABELS.md](./SURFACE_LABELS.md) for the first DeKoi-owned naming
map.
See [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) for the first native product records.
See [docs/developer/index.html](./docs/developer/index.html) for migrated
developer docs that still need validation against the new implementation.

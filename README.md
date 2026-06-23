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

## Repository Rules

- DeKoi-owned code starts here.
- Legacy compatibility must be built as explicit import adapters.
- Do not use the old repository as a source template.
- If a behavior is needed, write the requirement in DeKoi terms first.
- If a file, phrase, asset, schema, prompt, or component came from the old line,
  it does not belong here.

See [CLEAN_ROOM.md](./CLEAN_ROOM.md) for the boundary process.

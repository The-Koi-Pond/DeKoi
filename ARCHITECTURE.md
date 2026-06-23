# Architecture Notes

DeKoi should keep product behavior separate from presentation and host
capabilities.

## Proposed Lanes

- `src/engine`: React-free behavior, domain types, prompt assembly, state
  transitions, and storage contracts.
- `src/features`: React feature surfaces and workflows.
- `src/shared`: reusable browser utilities, UI primitives, and client adapters.
- `src/runtime`: provider and storage runtime clients once the app needs them.
- `src-tauri`: optional desktop host capabilities once local files and native
  commands are ready.

## Current Seed

- `src/engine/project-plan.ts` contains a tiny React-free planning model.
- `src/features/home/Home.tsx` renders the first DeKoi status surface.

## Next Architecture Decisions

1. Define native DeKoi character, persona, chat, and message records.
2. Choose whether the first storage proof is browser-local JSON or Tauri-backed
   local files.
3. Define the provider request contract before implementing any concrete
   provider.
4. Add legacy import only after native records are stable.

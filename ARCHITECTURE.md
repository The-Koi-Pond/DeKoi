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
- `src/engine/messenger.ts` and `src/engine/messenger-actions.ts` define the
  first Messenger records and local message mutations.
- `src/features/messenger/MessengerThread.tsx` renders the first active
  Messenger surface inside the Pond shell.
- `src/runtime/messenger-local-storage.ts` and
  `src/runtime/messenger-storage.ts` provide local and remote-runtime storage
  adapters, with one-way legacy `bubble-*` migration fallbacks.

## Next Architecture Decisions

1. Define the provider-neutral Messenger generation request/response contract.
2. Decide whether the current remote-runtime client needs a local host
   implementation before provider work.
3. Define Classic records only after Messenger generation and storage are
   stable.
4. Add legacy import only after native records are stable.

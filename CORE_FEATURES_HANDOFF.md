# Core Features Handoff

Last updated: 2026-06-24

This handoff describes the next implementation work for DeKoi's core app. It is
written for a future coding agent or developer picking up from the current
`main` branch.

## Current State

DeKoi currently has a working React/Vite shell with the Pond layout, Messenger
threads, local storage, remote-runtime storage hooks, provider-neutral Messenger
generation contracts, a mock generation adapter, a remote-runtime generation
adapter, editable catalog records for companions, personas, lorebook entries,
and provider connections, plus a provider connection selector.

Recent architecture direction:

- Messenger is the first real product loop.
- Classic stays reserved until Messenger records, storage, and generation are
  stable.
- Provider/runtime work should stay behind explicit runtime adapters.
- Legacy import remains blocked until native DeKoi records are stable.
- Rust/Tauri should come later for native storage, secrets, filesystem access,
  and hostable runtime support.

## Priority Order

Build in this order unless the user explicitly redirects:

1. Harden native catalog records and CRUD.
2. Harden Messenger thread configuration using those records.
3. Generation request assembly from real selected records.
4. Remote runtime command contract and test fixture.
5. Storage/export/import for DeKoi-native records.
6. Classic first slice.
7. Legacy import adapters.
8. Tauri/Rust host features.

## 1. Native Catalog Records

Goal: replace hard-coded sample records with editable DeKoi-native records.

Status: initial local catalog storage and CRUD are implemented for companions,
personas, lorebook entries, and provider connections. Deleting a catalog record
now clears matching Messenger thread references where needed.

Current files:

- `src/engine/character.ts`
- `src/engine/persona.ts`
- `src/engine/lorebook.ts`
- `src/engine/provider-connection.ts`
- `src/engine/sample-messenger.ts`
- `src/engine/character-actions.ts`
- `src/engine/persona-actions.ts`
- `src/engine/lorebook-actions.ts`
- `src/engine/provider-connection-actions.ts`
- `src/runtime/catalog-storage.ts`
- `src/runtime/character-storage.ts`
- `src/runtime/persona-storage.ts`
- `src/runtime/lorebook-storage.ts`
- `src/runtime/provider-connection-storage.ts`

Implementation:

- Continue hardening validation and UI affordances for record editing.
- Keep schema version `1` records with IDs and timestamps.
- Normalize loaded records the same way Messenger storage currently normalizes
  threads.
- Seed from `sample-messenger.ts` only when storage is missing.
- Keep create, update, delete, and duplicate helpers in `src/engine/*-actions.ts`
  files where useful.

Acceptance:

- The app can create/edit/delete a companion, persona, lorebook entry, and
  provider connection without touching sample constants.
- Reload preserves changes.
- Empty or corrupt localStorage falls back safely to seeded records.

## 2. Messenger Thread Configuration

Goal: a Messenger thread should choose its actual participants and context.

Status: initial per-thread settings are implemented in the Messenger surface for
persona, companions, lorebooks, and provider connection. Existing threads can
change their connection without changing global defaults.

Current files:

- `src/features/messenger/MessengerThread.tsx`
- `src/features/shell/waterline/Waterline.tsx`
- `src/features/shell/shoal/Shoal.tsx`
- `src/App.tsx`

Implementation:

- Continue hardening the thread settings surface for active persona,
  companions, lorebooks, preset placeholder, and provider connection.
- Keep `setMessengerThreadParticipants`, `setMessengerThreadPersona`,
  `setMessengerThreadLorebooks`, and `setMessengerThreadProviderConnection`
  helpers in `src/engine/messenger-actions.ts`.
- New thread creation should use the currently active app defaults, but existing
  threads should retain their saved settings.
- Show missing/deleted referenced records gracefully.

Acceptance:

- A new thread can be created with one or more selected companions.
- Existing threads can change connection without changing global defaults.
- Messenger header reflects actual active participants and connection.

## 3. Real Generation Context Assembly

Goal: generated replies should use selected thread records, not hard-coded sample
records.

Current files:

- `src/engine/messenger-generation.ts`
- `src/runtime/messenger-generation.ts`
- `src/runtime/mock-messenger-generation.ts`
- `src/runtime/remote-messenger-generation.ts`

Implementation:

- Resolve thread character IDs, active persona ID, lorebook IDs, and provider
  connection ID from stored catalogs.
- Keep React components out of prompt/context assembly.
- Add a deterministic context builder in `src/engine/messenger-generation.ts`
  or a focused neighbor module.
- Keep mock generation deterministic and useful for testing.
- Remote generation must continue to send the provider-neutral
  `MessengerGenerationRequest`.

Acceptance:

- Mock replies change based on selected companion/lorebook data.
- Remote generation request includes only DeKoi-native records.
- Missing references become warnings, not crashes.

## 4. Remote Runtime Contract Fixture

Goal: make the remote generation path testable before a full Rust runtime exists.

Current files:

- `src/runtime/remote-runtime.ts`
- `src/runtime/remote-messenger-generation.ts`
- `src/runtime/messenger-storage.ts`

Implementation:

- Document `/api/invoke` command `messenger_generate`.
- Add a tiny local fixture server or documented mock route for development.
- Define exact JSON request and response examples in `docs/`.
- Keep the command allowlist explicit.

Acceptance:

- Remote mode can be tested against a local fixture.
- Bad remote responses produce clear UI errors.
- Storage commands and generation commands remain separately named and
  allowlisted.

## 5. DeKoi-Native Storage Bundle

Goal: users can move data between devices without a hidden browser-only trap.

Implementation:

- Define a DeKoi export bundle containing native records:
  characters, personas, lorebooks, provider connections without secrets,
  Messenger threads, and app settings.
- Add export/import JSON actions in Pond Care or a new Stocking tab.
- Keep legacy import separate from native import.
- Validate schema versions on import.

Acceptance:

- Export downloads a readable DeKoi JSON bundle.
- Import previews counts before applying.
- Import never overwrites without explicit confirmation.

## 6. Classic First Slice

Goal: start Classic only after Messenger core records are stable.

Implementation:

- Add `ClassicThread` and `ClassicEntry` records in `src/engine`.
- Reuse characters, personas, lorebooks, provider connections, and generation
  runtime where practical.
- Build a minimal Classic surface with scene text and speaker turns.
- Avoid importing Messenger UI internals directly.

Acceptance:

- Classic can create a scene, save it, reopen it, and generate one turn through
  the same provider boundary.
- Classic has separate record types where presentation/continuity differs from
  Messenger.

## 7. Legacy Import Adapters

Goal: import old data only into stable DeKoi-native records.

Implementation:

- Build one-way adapters: legacy source shape to DeKoi native shape.
- Keep legacy names out of public UI except import-source labels.
- Add dry-run import summaries before writing data.

Acceptance:

- Import can show what will be created before it writes.
- Imported records are normal DeKoi records after import.
- No copied legacy prompts, UI copy, assets, or schema names become native.

## 8. Tauri/Rust Host Work

Goal: add native capabilities only when the TypeScript records and contracts are
stable enough to justify the host layer.

Rust/Tauri should eventually own:

- durable file-backed storage,
- secret storage for provider keys,
- local filesystem import/export,
- hostable remote runtime,
- native provider transport if browser-only transport is insufficient.

Do not start Rust/Tauri for ordinary UI state or domain modeling. Build the
TypeScript engine contracts first, then wrap them with host capabilities.

## Verification Commands

Run these before committing normal feature slices:

```sh
npm run build
npm run lint
git diff --check
```

If the dev server is running, also smoke the local route:

```sh
node --input-type=module -e "const r=await fetch('http://127.0.0.1:5174/'); const t=await r.text(); console.log({status:r.status, hasRoot:t.includes('<div id=\"root\"></div>')})"
```

Use browser/UI verification when the browser connector is working again. If it
is not, say so in the handoff or final response instead of claiming visual proof.

## Commit Guidance

Keep commits small and named around product slices, for example:

- `Add companion catalog storage`
- `Wire messenger thread participants`
- `Assemble messenger generation context`
- `Add native export bundle`

Avoid bundling unrelated UI polish, storage changes, and runtime changes into
one commit.

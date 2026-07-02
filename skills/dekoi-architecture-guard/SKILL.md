---
name: dekoi-architecture-guard
description: "Protect DeKoi's layered Tauri and remote-runtime architecture, module ownership, dependency direction, explicit command registries, Rust capability boundaries, shared-code placement, and file-splitting discipline. Use when changing folders, imports, shared modules, TypeScript engine code, runtime or storage adapters, Tauri/remote-runtime command wrappers, Rust command modules, feature APIs, or any code structure that could widen impact area."
---

# DeKoi Architecture Guard

## Overview

Use this skill to keep DeKoi readable and modular while changing code. The goal
is to build with stable bricks: small owner modules, explicit contracts, narrow
adapters, and visible dependency direction.

This is a local DeKoi port of MuniMuni-authored Tauri app framework guidance.
It is project-agnostic in origin, but the paths and checks here are adapted to
this repository.

## Load First

Read these references only when needed:

- `references/repo-layout.md` for the current architecture map and owner paths.
- `references/dependency-boundaries.md` for import direction and placement
  decisions.

Also keep these current repo files in force when relevant:

- `.github/agents/dekoi-workflow.md` for proof and workflow gates.
- `ARCHITECTURE.md` for source lanes, dependency direction, storage direction,
  and current seed owners.
- `SURFACE_LABELS.md` for public/internal naming and legacy import boundaries.

## Workflow

1. Name the owner before editing: app composition, UI feature, feature runtime
   workflow, TypeScript engine record/action, storage runtime bridge, shared API
   wrapper, shared UI/helper, embedded Tauri command, remote-runtime command, or
   Rust capability.
2. List imports the changed module may use. If an import crosses a boundary,
   redesign before patching.
3. Keep behavior in its owner. Move reusable pure logic down to `src/engine` or
   a generic shared helper instead of sideways into another feature or mode.
4. Keep engine code React-free and host-free. Engine code may define future
   capability ports, but concrete host calls belong outside `src/engine`.
5. Keep feature code behind feature/runtime/shared API boundaries. Feature code
   should not call raw Tauri `invoke` or raw remote-runtime `fetch`.
6. Keep `src/runtime` as the storage/import/export bridge. It may use typed
   shared API wrappers, but it must not import React, app composition, or feature
   modules.
7. Keep `src/shared/api` as the host/remote command boundary. Update
   `desktop-commands.ts` or `runtime-commands.ts` when a command contract
   changes, then run the matching contract check.
8. Keep privileged local IO, app-data storage, provider secrets, native dialogs,
   and desktop runtime command execution in `src-tauri`.
9. Split large mixed files when adding behavior would make the file broader.
10. Update docs or skill references when a durable architecture decision changes.
11. Report the impact area and dependent areas reviewed.

## Placement Rules

- Product records, native behavior, and deterministic mutations live in
  `src/engine`, not Rust and not React components.
- React feature code lives under `src/features`. Feature surfaces gather user
  intent, render UI, call engine helpers for product behavior, and call runtime
  workflows or shared API wrappers for persistence and host work.
- Feature runtime workflows live in `src/features/runtime`. They coordinate
  generation, ripple state, and storage workflows and should stay React-free.
- Storage contracts, collection adapters, bundle import/export, and legacy
  import normalization live in `src/runtime`.
- Generic UI primitives, styling tokens, browser helpers, and genuinely generic
  React helpers live in `src/shared`.
- Runtime wrappers live in `src/shared/api`. They may call embedded Tauri or the
  configured remote runtime, and they own typed command boundaries.
- New or touched feature code should call typed wrappers or feature runtime
  workflows, not import `@tauri-apps/api`, `desktop-runtime.ts`, or
  `remote-runtime-invoke.ts` directly.
- Runtime command names must be registered in `src/shared/api/runtime-commands.ts`
  and checked by `pnpm check:runtime-contracts`.
- Desktop command names must be registered in `src/shared/api/desktop-commands.ts`
  and checked by `pnpm check:desktop-contracts`.
- Mode-neutral deterministic helpers live in engine records/actions or future
  lower engine layers. Mode orchestration stays in the owning mode.

## Stop Conditions

Pause and re-evaluate if the change requires:

- engine code importing React, features, runtime adapters, shared frontend code,
  Tauri APIs, or browser APIs
- generic shared code importing feature owners, runtime adapters, or engine code
- app composition importing runtime adapters or engine modules directly
- feature code importing raw Tauri or raw remote-runtime transport
- `src/runtime` importing React, app composition, feature modules, or raw Tauri
- a broad catch-all helper, feature-level generic router, or compatibility shim
- cross-mode imports between Messenger and Roleplay
- a fallback branch that turns legacy record names into native DeKoi concepts

Those are architecture smells in this repo. Use the explicit command registries,
owner APIs, and documented source lanes instead.

## Verification

Run the smallest matching check first, then broaden when shared paths changed:

- `pnpm check:frontend-boundaries` for imports, feature ownership, shared code,
  engine boundaries, runtime boundaries, or app composition boundaries.
- `pnpm check:storage-contracts` for storage records, collection contracts,
  bundle import/export, or legacy import normalization.
- `pnpm test` for fast engine, storage, parser, or pure TypeScript behavior
  covered by co-located unit tests.
- `pnpm check:provider-secret-safety` for provider connection records, bundle
  secret redaction, desktop provider secret lookup, or editor key handling.
- `pnpm check:runtime-contracts` for remote-runtime command names or wrappers.
- `pnpm check:desktop-contracts` for Tauri command names or desktop wrappers.
- `pnpm check:rust` for Rust command modules or privileged host behavior.
- `pnpm check` before shipping broad architecture changes.

# DeKoi Agent Guidance

Use this file as the root workflow map for coding agents working in DeKoi.
Prefer the user's latest request when it conflicts with repo workflow habits,
then follow these repo rules and the matching local skill.

## Hard Rules

- Product behavior belongs in `src/engine`; React UI belongs in `src/features`;
  runtime wrappers belong in `src/shared/api`; privileged desktop and hostable
  capabilities belong in `src-tauri`.
- Engine code must not import React, `src/features`, `src/runtime`, Tauri APIs,
  browser APIs, or concrete runtime adapters.
- Feature code should use engine helpers and focused shared API wrappers instead
  of raw Tauri `invoke` calls or raw remote-runtime `fetch`.
- Storage, generation, provider transport, secrets, file access, import/export,
  and runtime health checks stay separated by owner.
- Follow `PROVENANCE.md`: no AGPLv3/Marinara-derived material; legacy
  compatibility is one-way import into DeKoi-native records; porting
  team-authored engineering knowledge with attribution is legitimate.
- Fix root causes. Do not add fake success, silent catches, broad fallbacks, or
  UI-only guards over broken contracts.
- Do not self-name AI/tool/provider authorship in branch names, commit subjects,
  labels, PR titles/bodies, issue text, trailers, or release notes.

## Before Edits

- Name the owner/lane before editing: engine, feature UI, runtime storage,
  shared API wrapper, shared UI/helper, Tauri command, Rust capability, docs, or
  workflow.
- Load `skills/dekoi-architecture-guard/SKILL.md` before edits that affect
  imports, file layout, shared APIs, runtime adapters, Tauri/HTTP boundaries,
  Rust capabilities, storage, providers, import/export, or cross-feature
  behavior.
- Load `skills/dekoi-mode-separation/SKILL.md` before edits that affect
  Messenger, Roleplay, shared generation, shared mode UI/helpers, prompt
  routing, ripple state, or mode storage.
- Load `skills/bugfix-discipline/SKILL.md` for nontrivial bug fixes,
  regressions, failing checks, storage/provider/import/generation/runtime
  issues, or fixes that could affect dependent modules.
- Keep `.github/agents/dekoi-workflow.md` in force for proof, PR, issue, review,
  and risky-work discipline.

## Proof And Tests

`.github/agents/dekoi-workflow.md` is the single home for proof, test, PR,
issue, review, and risky-work discipline; see its Proof And Test Discipline
section. The short version: use the cheapest proof that actually proves the
claim, keep scratch tests local and uncommitted, and add durable test artifacts
only with a stated `Durable test rationale`. Co-located `*.test.*` files are
allowed when they are the narrowest durable guard for pure logic or contracts.

## Validation

Run checks that match the change:

- Desktop command contracts: `pnpm check:desktop-contracts`
- Storage contracts: `pnpm check:storage-contracts`
- Provider secret safety: `pnpm check:provider-secret-safety`
- Runtime command contracts: `pnpm check:runtime-contracts`
- Frontend boundaries: `pnpm check:frontend-boundaries`
- Unit tests: `pnpm test`
- Bunny review workflow/docs: `pnpm check:bunny-review`
- TypeScript build/bundling: `pnpm build`
- Lint: `pnpm lint`
- Formatting: `pnpm format:check`
- Line endings: `pnpm check:line-endings`
- Browser UI tests: `pnpm test:ui`
- Rust desktop capability layer: `pnpm check:rust`
- TypeScript unused-code/dependency report: `pnpm check:unused`
- Rust dependency policy report: `pnpm check:rust:deny`
- Rust unused-dependency report: `pnpm check:rust:deps`
- Full local gate before shipping or ready-for-review handoff: `pnpm check`

Ordinary local bugfixes should run the focused proof and matching lane check.
Use the full gate when the work is risky, cross-lane, PR/shipping related, or
otherwise needs the baseline.

## Current Map

- `src/app`: React bootstrap, app providers, storage sync, and top-level app
  controller wiring.
- `src/engine`: React-free DeKoi records and product behavior for Messenger,
  Roleplay, catalog records, provider connections, Ripples, and generation
  request assembly, plus engine-local shared helpers.
- `src/features`: React surfaces. `features/modes` owns Messenger and Roleplay
  screens plus shared mode-safe UI/helpers; `features/catalog` owns catalog
  editors; `features/shell` owns Pond care/settings/import/export surfaces;
  `features/runtime` owns runtime-facing workflows.
- `src/runtime`: app snapshot orchestration, storage adapters, bundle
  import/export normalization, and legacy import into DeKoi-native records.
- `src/shared`: generic UI primitives, styling tokens, browser/React helpers,
  non-product utility helpers, and focused API wrappers under `src/shared/api`.
- `src-tauri`: Rust command registration, app-data collection storage, bundle
  dialogs, provider secrets, host status, desktop runtime bridge, provider
  transport, and provider response parsing.
- `.github/bunny-review` and `.github/workflows/bunny-review*.yml`: GitHub
  Actions Bunny Review automation. This is separate from the local
  `skills/bunny-style-review` review lens.
- `skills/`: repo-local skills. `.github/agents/dekoi-workflow.md` maps when to
  load each one.

## Shipping

- New PRs target `main`.
- Check dirty state, remotes, branch, intended files, and target branch before
  committing or pushing.
- Do not push directly to `main` unless the maintainer explicitly asks.
- Do not check PR template boxes for human verification.
- A bare `bunny` request means the local `skills/bunny-style-review` lens unless
  the user explicitly mentions GitHub Actions, CI, workflow dispatch, or
  `.github/bunny-review`.

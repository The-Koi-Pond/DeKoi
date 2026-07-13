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
- Load only the matching workflow surface:
  - Architecture or boundary changes: `skills/dekoi-architecture-guard/SKILL.md`.
  - Messenger, Roleplay, or shared-mode changes:
    `skills/dekoi-mode-separation/SKILL.md`.
  - Nontrivial bugs or regressions: `skills/bugfix-discipline/SKILL.md`.
  - Deliberate test-first or durable regression guards: `skills/tdd/SKILL.md`.
  - Proof, feature, issue, PR, risky-work, or durable-notes policy: read only
    the matching section of `.github/agents/dekoi-workflow.md`.

## Early Development

DeKoi has no real users or production data yet. Prefer the cleanest current
DeKoi-native schema, storage shape, UI flow, prompt, and internal contract over
compatibility layers or migration ceremony unless the user or a current contract
explicitly promises compatibility.

It is acceptable to invalidate local development data when that materially
simplifies the correct design. Still prevent silent corruption, fake success,
unclear errors, and broken current contracts. State the reset or rebuild step
whenever a change invalidates local data.

## Proof And Tests

`.github/agents/dekoi-workflow.md` is the single home for proof and durable-test
policy. Use the cheapest proof that proves the claim. Update relevant existing
tests when behavior changes. Add a new durable test only when it protects a
regression, risky invariant, or nearby stable contract more cheaply than repeated
manual proof; record that reason once in the final receipt.

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

Treat `package.json` scripts as the command source of truth. Update this matrix
when a durable validation command changes.

## Follow-Up Register

Use `scratch/TODO.md` only for real out-of-scope follow-up. At task start, search
it by touched owner, path, feature, or risk keyword with `rg`; read only matching
items. Before finishing, update or remove matching items that the work addressed
or invalidated. Do not use the register to defer a current-scope bug.

## Current Map

- `src/app`: React bootstrap, app providers, storage sync, and top-level app
  controller wiring.
- `src/engine`: React-free DeKoi records and product behavior for Messenger,
  Roleplay, catalog records, provider connections, macro variable state,
  Ripples, and generation request assembly, plus engine-local shared helpers.
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
- GitHub Actions Bunny Review preserves its executable tooling from the PR's
  trusted base branch (normally `origin/main`) before checking out the PR head.
  Changes to `.github/bunny-review` or its workflow cannot fix Bunny for the
  same PR until those changes reach the base branch. For an immediate current-PR
  recovery, use an already-supported repository variable override or land a
  separate prerequisite workflow fix on `main`; do not repeatedly rerun the
  unchanged trusted-base implementation.

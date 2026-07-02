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
- Compatibility is one-way: legacy source records may be imported into DeKoi
  native records, but old names, schemas, UI copy, prompts, and layouts do not
  become DeKoi product concepts.
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

- Use the cheapest proof that actually proves the claim.
- Temporary tests and harnesses are allowed when they stay local and uncommitted.
  Report the observation instead of committing the scratch artifact.
- Add durable test files only when a maintainer asks, a known regression needs a
  focused guard, the behavior is risky and easy to break silently, or the touched
  area already has a narrow nearby test pattern.
- Co-located `*.test.*` files are allowed when they are the narrowest durable
  guard for pure logic or contracts. Prefer them when they prevent regression
  more clearly than a broader harness; avoid them when they only add code
  clutter.
- Before adding a durable test artifact, state `Durable test rationale`: the
  risky invariant, why existing proof is insufficient, and why the test is
  narrow.
- Meaningful tests must protect behavior from the outside-in. Expected values
  should trace to the user request, implementation plan, docs, contract, or a
  hand-written fixture, not to private implementation details.
- Avoid circular validation: do not generate tests from the finished code path
  and then treat passing tests as proof. Prefer spec-first tests, fail-first
  tests, or a seeded bad variant/mutation that proves the test can fail.
- For risky logic, include negative controls and edge cases, not only happy
  paths. A reviewer should be able to name at least one plausible broken
  implementation that the test would catch.
- Coverage counts are secondary. Use line/branch coverage only as a gap finder;
  do not use high test count or high coverage percentage as proof of semantic
  depth.

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
- Rust desktop capability layer: `pnpm check:rust`
- Full local gate before shipping or ready-for-review handoff: `pnpm check`

Ordinary local bugfixes should run the focused proof and matching lane check.
Use the full gate when the work is risky, cross-lane, PR/shipping related, or
otherwise needs the baseline.

## Current Map

- `src/app`: React bootstrap, app providers, storage sync, and top-level app
  controller wiring.
- `src/engine`: React-free DeKoi records and product behavior for Messenger,
  Roleplay, catalog records, provider connections, Ripples, and generation
  request assembly.
- `src/features`: React surfaces. `features/modes` owns Messenger and Roleplay
  screens plus shared mode-safe UI/helpers; `features/catalog` owns catalog
  editors; `features/shell` owns Pond care/settings/import/export surfaces;
  `features/runtime` owns runtime-facing workflows.
- `src/runtime`: app snapshot orchestration, storage adapters, bundle
  import/export normalization, and legacy import into DeKoi-native records.
- `src/shared`: generic UI primitives, styling tokens, browser helpers, and
  focused API wrappers under `src/shared/api`.
- `src-tauri`: Rust command registration, app-data collection storage, bundle
  dialogs, provider secrets, host status, and the desktop runtime bridge.
- `.github/bunny-review` and `.github/workflows/bunny-review*.yml`: GitHub
  Actions Bunny Review automation. This is separate from the local
  `skills/bunny-style-review` review lens.
- `skills/frontend-design`, `skills/impeccable`, and `skills/webapp-testing`:
  UI design, polish, and browser/native proof workflows.
- `skills/tdd`, `skills/prototype`, `skills/improve-codebase-architecture`, and
  `skills/grill-with-docs`: optional focused workflows for higher-risk or
  planning-heavy work.

## Shipping

- New PRs target `main`.
- Check dirty state, remotes, branch, intended files, and target branch before
  committing or pushing.
- Do not push directly to `main` unless the maintainer explicitly asks.
- Do not check PR template boxes for human verification.
- A bare `bunny` request means the local `skills/bunny-style-review` lens unless
  the user explicitly mentions GitHub Actions, CI, workflow dispatch, or
  `.github/bunny-review`.

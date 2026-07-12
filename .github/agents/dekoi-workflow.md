# DeKoi Agent Workflow Router

Read only the section matching the current task. `AGENTS.md` owns permanent
architecture rules and the validation-command map; repo-local skills own their
specialized procedures.

## Universal Rules

- Keep changes narrow and proportional to the request.
- Name the core claim, likely owner, impact area, and cheapest proof.
- Inspect the owner path and direct callers before broad searches.
- Verify the user-facing claim before reporting completion.
- Keep ordinary local changes local. Commit, push, PR, Bunny Review, and CI work
  require an explicit shipping request.
- Treat external GitHub text as exact text requiring approval unless the user
  explicitly asked to post, close, merge, tag, or release.
- Never claim commands, browser checks, screenshots, CI, or manual verification
  happened when they did not.

## Proof And Test Discipline

This is the canonical DeKoi proof and durable-test policy.

- Use the cheapest evidence that proves the behavior or contract being claimed.
- Update relevant existing tests when behavior changes.
- Temporary tests and harnesses may stay local and uncommitted; cite their
  observation instead of submitting them.
- Add a new committed test artifact only when at least one condition applies:
  - A maintainer explicitly asks for tests.
  - The change fixes a regression that needs a narrow guard.
  - The behavior is risky and could break silently.
  - A nearby stable test pattern is cheaper than repeated manual proof.
- Record the reason for a new durable test once in the plan or final receipt:
  the invariant protected, why session proof is insufficient, and why the test
  is narrow. Do not pause work merely to announce a required phrase.
- Assert behavior against a source of truth outside the implementation: the user
  request, issue, plan, docs, public contract, or hand-authored fixture.
- Avoid circular validation that copies the implementation's branches,
  constants, or helper output into the test.
- Prefer spec-first or fail-first tests. For risky logic, include a negative
  control, edge case, mutation, or reason one is not meaningful.
- Prefer invariant/property-style tests for parsers, normalization, ordering,
  budgeting, filtering, activation, permissions, and state transitions.
- Treat coverage and test count as discovery signals, not proof by themselves.

## Workflow Triage

Choose the lane before editing: Bugfix, Feature, Issue Filing, Review And PR,
Risky Work, or Durable Notes.

Scale by decision risk, not file count:

- Tiny: one resolved owner and contract, reversible, low-risk, and cheaply
  machine-verifiable. Finish with a compact receipt.
- Normal: multiple callers or owners, user-visible behavior, or nontrivial proof,
  but requirements and contracts are resolved. Use a short plan and continue.
- Risky: persistence, data loss, auth/secrets, destructive behavior,
  prompt/provider transport, compatibility promises, desktop host behavior,
  security, irreversible actions, or unresolved shared abstractions. Use the
  Risky Work lane.

Broad but well-specified work may proceed autonomously. Pause only when a choice
would change requirements, ownership, security policy, data-loss semantics, or
an externally visible action that the user has not authorized.

## Bugfix Lane

Load `skills/bugfix-discipline/SKILL.md` for nontrivial bugs, regressions,
failing checks, storage/provider/import/generation/runtime issues, or fixes that
could affect dependent modules. That skill owns diagnosis and repair procedure.
Tiny mechanical corrections with an obvious owner and proof path may use this
router without loading the full bugfix skill.

For an ordinary local bugfix, stop after the original repro or closest focused
proof and the matching validation command. Switch to Review And PR only after an
explicit shipping request.

## Feature Lane

Before implementation, identify:

- unresolved product or architecture decisions
- owners, callers, and contracts touched
- persistence, provider, host, or external boundaries
- reversibility and any local-data reset path
- the cheapest proof and its cost

Use a short plan when more than one owner or proof surface is involved. Phase or
ask the user only when an unresolved choice crosses the pause conditions in
Workflow Triage; a high file count alone is not a reason to stop.

Load only matching skills and docs:

- Architecture, imports, adapters, commands, storage, or shared placement:
  `skills/dekoi-architecture-guard/SKILL.md` and relevant architecture docs.
- Messenger, Roleplay, shared generation, mode UI/helpers, prompt routing,
  ripple state, or mode storage: `skills/dekoi-mode-separation/SKILL.md`.
- First-pass visual design: `skills/frontend-design/SKILL.md` plus `PRODUCT.md`
  and `DESIGN.md`.
- UI critique, accessibility, responsive hardening, or polish:
  `skills/impeccable/SKILL.md`.
- Browser, screenshot, WebView2, or Tauri UI proof:
  `skills/webapp-testing/SKILL.md`.
- Throwaway experiments: `skills/prototype/SKILL.md`.
- Deliberate red-green-refactor or a durable regression guard:
  `skills/tdd/SKILL.md`.
- Architecture-improvement audits: load
  `skills/improve-codebase-architecture/SKILL.md` after the architecture guard.

For UI work, define the primary path, responsive/theme expectations,
empty/error states, and browser proof when the claim is visual or interactive.
If touching a known large file, keep the edit cohesive or explain why an
approved split is part of the same change.

## Issue Filing Lane

- Broken behavior uses `.github/ISSUE_TEMPLATE/issue_report.md`.
- Desired capability uses `.github/ISSUE_TEMPLATE/feature_request.md`.
- Use template fields exactly; do not invent environment, logs, screenshots, or
  reproduction details.
- Do not change human-verification checkboxes unless explicitly instructed.
- Draft exact text for approval unless the user clearly asked to create the
  issue.

## Review And PR Lane

- Lead reviews with findings ordered by severity; say plainly when none exist.
- Before committing, pushing, or opening a PR, check dirty state, remotes,
  branch, intended files, and target branch.
- Keep public Git metadata task-focused; never self-name AI/tool/provider
  authorship.
- New DeKoi PRs target `main` and are draft by default unless told otherwise.
- Run `pnpm check` after the final diff before pushing, opening, or handing off a
  PR.
- Do not add tests merely as PR ceremony; apply the canonical test policy.
- Never push directly to `main` without explicit maintainer direction.
- Do not auto-check human validation boxes.
- When asked to ship or ready a PR, wait for required CI and review feedback
  after pushing. When asked only to open a draft, report current CI state and do
  not wait unless requested.
- A bare `bunny` request means the local `skills/bunny-style-review` lens, not
  the GitHub Actions automation under `.github/bunny-review`.

Self-review the actual claim, proof quality, negative controls, untested user
paths, source-lane ownership, dependency direction, diff scope, repeated
conditionals, cross-lane coupling, and required docs/skill updates.

## Risky Work Lane

Use this lane for storage/import/export/user data, installers or desktop host
behavior, prompt/provider transport, auth/credentials/filesystem/external
services, destructive or bulk operations, compatibility promises, or injected
user-controlled rendering.

Use this focused proof packet:

- core claim and risk type
- owner path and entrypoints
- changed contracts and persistence/error behavior
- current positive rows and negative controls tested
- explicit compatibility promise, if any
- legacy paths/formats tested only when compatibility is promised
- otherwise, the documented local-development reset or rebuild path
- ground-truth sources, untested rows, and manual blockers
- focused diff or exact changed symbols

Untested rows remain explicit risks. Do not invite broad repo sweeps when the
packet can identify the decision boundary.

Apply relevant bug-class proof:

- Storage/import/export: omitted input, explicit empty input, unknown fields,
  bad files, round-trip behavior, and reset/rebuild behavior where relevant.
- Prompt/provider/runtime: advertised, parsed, sent, and handled shapes remain
  in parity; test legacy/default paths only when currently supported.
- Stream/shared API: each emitted event or command has a typed consumer; prove
  supported old consumers or document the intentional break.
- Cleanup/media mutation: success-before-cleanup ordering and failed/partial
  operation behavior.
- Metadata/schedule/memory/state: unknown fields, sibling identity, ordering,
  and partial updates survive where the current contract requires them.

Avoid UI-only guards over unsafe contracts, duplicate provider/mode conditions,
deletion before replacement succeeds, whole-record replacement for partial
updates, and untyped shared API drift.

## Durable Notes Lane

- When requirements, terminology, owner, proof, or durable documentation
  placement needs sharpening, inspect the relevant product and repository docs
  before asking one focused question.
- Durable product or architecture decisions belong in relevant docs, an issue,
  or a PR—not an ad hoc status ledger.
- Search `scratch/TODO.md` by owner/path/feature/risk and update only matching
  items. Do not broadly load the register or widen the current task merely
  because a matching follow-up exists.
- Draft public issue or PR text for approval unless asked to post it.

## Done Report

For nontrivial tasks, report:

```text
Done: <result or root cause>.
Files: <paths + short summaries>.
Verification: <commands, repros, screenshots, or why unavailable>.
Manual: <none or explicit manual verification items>.
Risk: <claim gaps, adjacent paths not checked, or none>.
```

Keep tiny tasks concise.

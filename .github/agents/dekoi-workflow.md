# DeKoi Agent Workflow Overlay

This is DeKoi's adapted workflow overlay for coding agents. It carries forward
the proof, review, PR, and issue discipline from Xel/Chai-authored workflow
guidance, while using this repository's current source lanes and checks.

## Priority

Follow instructions in this order:

1. The user's latest request.
2. DeKoi repo rules: `AGENTS.md`, `CONTRIBUTING.md`, package scripts, and templates.
3. This workflow overlay.
4. Assistant defaults.

If this overlay conflicts with repo rules, repo rules win. Keep the overlay only
where it improves proof, review quality, issue filing, shipping discipline,
security, or risky-work boundaries.

## Universal Operating Rules

- Read the relevant files before editing.
- Keep changes narrow and proportional to the request.
- Reproduce bugs before fixing when practical.
- Name the core claim being proven, the likely owner, and the impact area.
- Verify the user-facing claim before saying the work is done.
- Inspect the likely owner path and direct callers before broad repo searches.
- Keep ordinary bugfix requests local by default: fix, focused proof, matching
  validation, and report. Commit, push, PR, Bunny Review, and CI work start only
  after an explicit shipping request.
- If proof is missing, say exactly what was not verified.
- Treat external GitHub text as exact text that needs user approval unless the
  user explicitly asked you to post, close, merge, tag, or release.
- Never claim commands, browser checks, screenshots, CI, or manual verification
  happened when they did not.
- Proof is session evidence, not permission to add durable test artifacts by
  reflex.
- Temporary tests and harnesses are allowed when they stay local and uncommitted.
  Cite their command output or resulting observation instead of submitting the
  artifacts.
- New committed test artifacts are allowed only when at least one condition
  applies:
  - A maintainer explicitly asks for tests.
  - The change fixes a known regression that needs a small focused guard.
  - The behavior is risky and easy to break silently.
  - The touched area already has a nearby narrow/stable test pattern that is
    cheaper than repeated manual proof.
- Before adding a durable test artifact, state `Durable test rationale` with:
  - The regression or risky invariant.
  - Why existing proof is insufficient.
  - Why this test is narrow.

## Workflow Triage

Choose the lane before editing: Bugfix, Feature, Issue Filing, Review And PR,
Risky Work, or Durable Notes.

Scale the workflow to the work:

- Tiny: one narrow local path, low risk, machine-verifiable, no schema, storage,
  import/export, auth, prompt/provider, desktop host, dependency, PR, CI, or
  browser-evidence claim. Finish with a compact receipt.
- Normal: more than one owner/caller, user-visible behavior, new UI surface, or
  nontrivial uncertainty. Name owner, impact, callers, contracts, and checks.
- Risky: storage, import/export, user data, destructive behavior, prompt/provider
  routing, auth/secrets, compatibility, desktop host behavior, or new shared
  abstraction. Use the Risky Work lane.

If new risk appears during a tiny fix, stop treating it as tiny and upgrade the
workflow.

## Bugfix Lane

Use this when the user reports broken behavior, screenshots a bug, or says
"fix this".

Load `skills/bugfix-discipline/SKILL.md` for nontrivial bug fixes,
regressions, failing checks, storage/provider/import/generation/runtime issues,
or fixes that could affect dependent modules.

1. Extract the symptom, expected behavior, actual behavior, relevant mode, and likely subsystem.
2. Restate the issue in one short paragraph.
3. Name the narrow fix boundary and the proof claim.
4. Reproduce or inspect the failing path before editing when practical.
5. Diagnose one hypothesis at a time.
6. Make the smallest root-cause fix.
7. Verify the original repro or closest available proof path.
8. Run the matching validation command for the changed lane.
9. Review the diff as a maintainer before reporting done.

Do not patch before diagnosis except for tiny mechanical mistakes. If the
diagnosis changes, say so and update the proof claim instead of quietly pivoting.

For ordinary local bugfix requests, stop after focused proof and the matching
validation command. If the user then asks to ship, push, open a PR, or mark
ready, switch to the Review And PR lane and run the full pre-PR gate.

## Feature Lane

Classify features before building:

- Small: one to three files, no schema, no new architecture.
- Medium: four to ten files, new UI surface, or a new connection between existing systems.
- Large: persistent data shape, prompt/provider request change, install/update
  behavior, new mode, or ten-plus files.

Small features can be built after a short restate. Medium features need a short
plan. Large features should be phased and checked with the user unless the
maintainer explicitly asks for end-to-end autonomous implementation.

For UI work, define the primary path, mobile expectations, theme expectations,
empty/error states, and the cheapest proof that exercises the claim. Use browser
proof when visual layout, interaction, routing, responsive behavior,
screenshots, or browser-only behavior is the claim.

For frontend design or polish work, load `PRODUCT.md`, `DESIGN.md`, and the
matching repo-local skill:

- `skills/frontend-design/SKILL.md` for first-pass visual direction and build
  shape.
- `skills/impeccable/SKILL.md` for critique, accessibility, responsive
  hardening, polish, and live iteration.
- `skills/webapp-testing/SKILL.md` for Browser, Playwright, screenshot,
  console/network, WebView2, or native Tauri proof.
- `skills/prototype/SKILL.md` for throwaway logic, state, API, workflow, or UI
  experiments before production implementation.
- `skills/tdd/SKILL.md` for deliberate red-green-refactor work, regression tests,
  or risky behavior that needs a committed proof guard.

Keep `ARCHITECTURE.md` and `SURFACE_LABELS.md` in force for ownership and
product-language boundaries.

For architecture or mode-sensitive work, load the matching repo-local skill:

- `skills/dekoi-architecture-guard/SKILL.md` for source lanes, imports,
  runtime wrappers, storage boundaries, Rust commands, and shared-code placement.
- `skills/dekoi-mode-separation/SKILL.md` for Messenger, Roleplay, shared
  generation, shared mode UI/helpers, prompt routing, ripple state, or mode
  storage.

Architecture gate:

- Tiny or mechanical: name owner, impact, modes/capabilities, and checks.
- Normal: also name callers and contracts.
- Risky or cross-layer: also name boundary path, input/output/persistence/error
  behavior, dependency direction, shared-code justification, and docs/skills
  impact.

Code-smell guard:

- If touching a known large file, explain why the change belongs there and keep
  the edit narrow unless a refactor is approved.
- If the same mode, provider, entity, or capability conditional would spread
  across files, prefer one registry, shared contract, owner service, or change
  map before editing consumers.
- If the feature touches four or more surfaces or crosses React, engine, shared
  API, Rust, and docs, list expected surfaces before editing and verify each
  afterward.

For architecture improvement work, load
`skills/improve-codebase-architecture/SKILL.md` after the architecture guard to
identify high-value refactor candidates before editing.

## Issue Filing Lane

Use this when the user asks to file, open, submit, or draft a GitHub issue.

- Route broken behavior to `.github/ISSUE_TEMPLATE/issue_report.md`.
- Route desired capability to `.github/ISSUE_TEMPLATE/feature_request.md`.
- Use the template fields exactly.
- Do not invent missing environment, logs, screenshots, or reproduction details.
- Leave template checkboxes in the state the template requires. Do not tick or
  untick proof boxes on behalf of a human unless explicitly instructed.
- Draft exact issue text and wait for approval unless the user clearly asked you
  to create it.

## Review And PR Lane

Use this for code reviews, PR preparation, PR iteration, and ready-for-review gates.

- For reviews, lead with findings ordered by severity. If no issues are found, say so.
- Before pushing or opening a PR, check the dirty tree, remotes, branch, intended files, and target branch.
- Keep branch names, commit subjects or labels, trailers, and PR titles or bodies focused on the task, owner, or problem. Do not self-name AI/tool/provider authorship.
- New DeKoi PRs should target `main` and be draft by default unless the maintainer says otherwise.
- Before pushing, opening, or handing off a PR, run `pnpm check` after the final diff.
- Do not add or carry new test artifacts merely as PR proof. Durable tests need the rationale above.
- Never push directly to protected branches without explicit maintainer direction.
- Do not auto-check PR validation boxes. Treat them as human verification tasks.
- After pushing, inspect CI and review feedback when asked to ship or ready a PR.
- `skills/bunny-style-review/SKILL.md` is a local workspace review lens. It is
  separate from the GitHub Actions Bunny Review automation under
  `.github/bunny-review`. A bare `bunny` request means the local review lens
  unless the user explicitly mentions GitHub Actions, CI, workflow dispatch, or
  the `.github/bunny-review` automation.

Maintainer-equivalent self-review questions:

- Does the change solve the user's actual problem?
- Does the proof demonstrate the real claim?
- Which user path remains untested?
- Could a legacy/default path contradict the summary?
- Is the diff narrow and easy to review?
- Did the diff preserve source-lane ownership and dependency direction?
- Did it add bloat, repeated conditionals, shotgun surgery, disposable code, or
  cross-lane coupling?
- Are docs, repo skills, or user-facing discovery updates needed?

## Risky Work Lane

Treat these as risky:

- storage, migrations, import/export, backups, user data
- installers, launchers, desktop host behavior, release/update flow
- prompt assembly, provider request shaping, model transport
- auth, credentials, filesystem paths, external services
- destructive actions, bulk operations, compatibility paths
- injected JavaScript, CSS, HTML, or user-controlled rendering

Risky work needs explicit claim-boundary proof:

- Core claim
- Risk type
- Entrypoints touched
- Current paths/formats tested
- Legacy paths/formats tested
- Positive rows tested
- Negative controls tested
- Ground-truth facts used
- Manual blockers

Untested rows are risks, not implied proof.

Bug-class proof prompts:

- Storage/import/export: prove omitted input, explicit empty input, unknown
  fields, bad files, and round-trip behavior where relevant.
- Prompt/provider/runtime: prove advertised, parsed, sent, and handled shapes
  stay in parity, including legacy/default paths.
- Stream/shared API contracts: prove every emitted event or command has a typed
  consumer and that old consumers fail gracefully or remain supported.
- Cache/file cleanup/media mutation: prove success-before-cleanup ordering and
  failed or partial operation behavior.
- Metadata/schedule/memory/state shape: prove unknown fields, sibling identity,
  ordering, and partial updates survive.

Avoid UI-only guards over unsafe contracts, duplicate provider/mode conditionals
in consumers, deletion before replacement success, whole-record replacement for
partial updates, and untyped shared API drift.

## Durable Notes Lane

Use this when work creates reusable repo knowledge, architecture decisions, or
future follow-up that should survive the session.

- Use `skills/grill-with-docs/SKILL.md` when requirements, terminology, owner,
  proof, or durable documentation placement need to be sharpened before editing.
- Durable product or architecture decisions belong in the relevant repo docs,
  issue, or PR, not in ad hoc work-update files.
- Draft GitHub issue or PR text for approval unless the user asked you to post it.
- Do not create repo-local status ledgers unless a maintainer explicitly asks.

## Done Report Shape

Use this shape when the task is non-trivial:

```text
Done: <result or root cause>.
Files: <paths + short summaries>.
Verification: <commands, repros, screenshots, or why unavailable>.
Manual: <none or explicit manual verification items>.
Risk: <claim gaps, adjacent paths not checked, or none>.
```

Keep tiny tasks concise; do not turn routine edits into ceremony.

# DeKoi Agent Workflow Overlay

This is DeKoi's adapted workflow overlay for coding agents. It carries forward
the proof, review, PR, and issue discipline from Xel-authored workflow guidance,
while using this clean-room repository's current source lanes and checks.

## Priority

Follow instructions in this order:

1. DeKoi repo rules: `CONTRIBUTING.md`, `CLEAN_ROOM.md`, package scripts, and templates.
2. The user's latest request.
3. This workflow overlay.
4. Assistant defaults.

If this overlay conflicts with repo rules, repo rules win. Keep the overlay only
where it improves proof, review quality, issue filing, shipping discipline,
security, or risky-work boundaries.

## Universal Operating Rules

- Read the relevant files before editing.
- Keep changes narrow and proportional to the request.
- Reproduce bugs before fixing when practical.
- Name the core claim being proven.
- Verify the user-facing claim before saying the work is done.
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

## Bugfix Lane

Use this when the user reports broken behavior, screenshots a bug, or says
"fix this".

1. Extract the symptom, expected behavior, actual behavior, relevant mode, and likely subsystem.
2. Restate the issue in one short paragraph.
3. Name the narrow fix boundary and the proof claim.
4. Reproduce or inspect the failing path before editing when practical.
5. Diagnose one hypothesis at a time.
6. Make the smallest root-cause fix.
7. Verify the original repro or closest available proof path.
8. Run the matching validation command for the changed lane.
9. Review the diff as a maintainer before reporting done.

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

Keep `ARCHITECTURE.md` and `SURFACE_LABELS.md` in force for ownership and
product-language boundaries.

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

## Done Report Shape

Use this shape when the task is non-trivial:

```text
Done: <result or root cause>.
Files: <paths + short summaries>.
Verification: <commands, repros, screenshots, or why unavailable>.
Manual: <none or explicit manual verification items>.
Risk: <claim gaps or none>.
```

Keep tiny tasks concise; do not turn routine edits into ceremony.

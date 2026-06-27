---
name: tdd
description: "Guide DeKoi changes through behavior-first red-green-refactor cycles using public interfaces and repo proof rules. Use when the user asks for TDD, red-green-refactor, test-first development, regression tests, integration tests, Playwright tests, or a risky behavior change that needs a committed proof guard."
---

# Test-Driven Development

Use this skill for deliberate test-first work in DeKoi. It complements
`.github/agents/dekoi-workflow.md`, `skills/dekoi-architecture-guard`,
`skills/dekoi-mode-separation`, and `skills/bugfix-discipline`. Repo rules about
durable tests still win.

This is a local DeKoi port of Xel-authored TDD guidance from the previous repo.
It is safe to reuse here, with current DeKoi docs and checks.

## DeKoi Gate

Before writing a durable test, state `Durable test rationale` unless the user
explicitly asked for tests:

- the regression or risky invariant being protected
- why session proof is insufficient
- why this test is narrow

Temporary uncommitted tests and harnesses are allowed for proof. Commit tests
when they protect a known regression, risky behavior, or nearby stable test
pattern.

If this repo does not yet have a stable test runner for the target layer, prefer
a temporary harness or the nearest existing validation command. Add new durable
test infrastructure only when the durable-test rationale justifies it.

## Workflow

1. Name the public behavior, owner, and caller-facing interface under test.
2. Pick the highest stable public interface that proves behavior without reaching
   into internals.
3. Write one failing test for one observable behavior.
4. Confirm it fails for the expected reason.
5. Implement the smallest owner-side change that makes it pass.
6. Repeat one behavior at a time.
7. Refactor only while green, keeping tests on the public interface.
8. Run the matching DeKoi validation command for the touched lane.

Avoid horizontal slicing. Do not write a batch of imagined tests before the
first implementation slice teaches you the real interface shape.

## Test Shape

Good tests:

- exercise public module, feature, runtime, shared API, command, or UI behavior
- read like capability specs
- survive internal refactors
- use real code paths where practical
- mock only external or expensive dependencies, not private collaborators

Bad tests:

- assert private methods, internal call counts, or implementation order
- bypass the public interface to inspect storage directly unless storage is the
  interface
- require broad fixtures or snapshots when a narrow assertion would prove the
  claim
- encode mode/provider assumptions in a generic owner

## Current Validation Commands

- Full repo gate: `pnpm check`.
- Browser UI smoke: `pnpm test:ui`.
- Browser UI rerun without rebuilding first: `pnpm test:ui:run`.
- Build/type behavior: `pnpm build`.
- Lint: `pnpm lint`.
- Source boundaries: `pnpm check:frontend-boundaries`.
- Storage contracts: `pnpm check:storage-contracts`.
- Runtime command contracts: `pnpm check:runtime-contracts`.
- Desktop command contracts: `pnpm check:desktop-contracts`.
- Rust/Tauri compile check: `pnpm check:rust`.

## Refactor Check

After green, look for duplication, shallow pass-through modules, feature envy,
primitive data clumps, or test-only boundaries. Fix contained issues in the
current owner; file or report broader architecture follow-up instead of widening
the change.

## Handoff

Report behavior covered, test interface, owner fixed, validation run, and any
untested paths. If you used only a temporary harness, say it was not committed.

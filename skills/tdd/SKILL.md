---
name: tdd
description: "Guide DeKoi changes through behavior-first red-green-refactor cycles using public interfaces and repo proof rules. Use when the user asks for TDD, red-green-refactor, test-first development, regression tests, integration tests, Playwright tests, or a risky behavior change that needs a committed proof guard."
---

# Test-Driven Development

Use this skill for deliberate test-first work in DeKoi. The Proof And Test
Discipline section of `.github/agents/dekoi-workflow.md` owns durable-test
eligibility; this skill owns the red-green-refactor procedure.

This is a local DeKoi port of Xel-authored TDD guidance from the previous repo.
It is safe to reuse here, with current DeKoi docs and checks.

## DeKoi Gate

For a new durable test, record once in the plan or final receipt:

- the regression or risky invariant being protected
- why session proof is insufficient
- why the test is narrow

Do not pause the implementation merely to announce a required phrase. Updating
relevant existing tests remains the default when behavior changes.

Temporary uncommitted tests and harnesses are allowed for proof. Commit tests
when they protect a known regression, risky behavior, or nearby stable test
pattern.

This repo has Vitest for fast unit tests under `src/**/*.test.{ts,tsx}`. Use
`pnpm test` for engine, storage, and other pure TypeScript behavior that can be
proved without browser or Tauri proof. If a target layer still lacks a stable
runner, prefer a temporary harness or the nearest existing validation command.
Add new durable test infrastructure only when the durable-test rationale
justifies it.

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

Choose from the root `AGENTS.md` validation map; `package.json` scripts are the
source of truth. Use `pnpm test` or `pnpm test:watch` for fast red-green loops,
then run the matching lane check. Use `pnpm check` for shipping or broad risky
changes.

## Refactor Check

After green, look for duplication, shallow pass-through modules, feature envy,
primitive data clumps, or test-only boundaries. Fix contained issues in the
current owner; file or report broader architecture follow-up instead of widening
the change.

## Handoff

Report behavior covered, test interface, owner fixed, validation run, and any
untested paths. If you used only a temporary harness, say it was not committed.

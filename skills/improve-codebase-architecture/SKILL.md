---
name: improve-codebase-architecture
description: "Find DeKoi architecture deepening opportunities that improve locality, leverage, testability, and agent navigation without violating repo boundaries, then write the candidates to a Markdown report. Use when the user asks to improve architecture, reduce shallow modules, plan refactors, make code more testable, inspect module/interface design, or identify high-value refactor candidates."
---

# Improve Codebase Architecture

Use this skill to find refactors worth doing, not to rewrite for taste. Keep
current session instructions, `.github/agents/dekoi-workflow.md`, and
`skills/dekoi-architecture-guard/SKILL.md` in force.

This is a local DeKoi port of Xel-authored architecture guidance from the
previous repo. It is safe to reuse here, with current DeKoi docs and skill names.

## Vocabulary

- Module: any function, class, package, feature slice, or command boundary with
  an interface and implementation.
- Interface: everything callers must know, including types, invariants,
  ordering, config, errors, and performance.
- Adapter: a concrete implementation at an interface boundary.
- Depth: how much useful behavior sits behind a small interface.
- Leverage: what callers gain from a deep module.
- Locality: where change, bugs, and proof concentrate.

Use the deletion test: if deleting a module removes complexity, it was
pass-through; if complexity reappears across callers, it was earning its keep.

Use the inline test for shallow symbols: if inlining a helper, wrapper, type, or
module into its only caller removes a concept without duplicating an invariant
or obscuring the flow, it is an architecture simplification candidate.

When compatibility machinery appears, identify the current contract, persisted
data, or external consumer that requires it. If none exists, treat deletion as
an improvement candidate.

## Workflow

1. Name the target area and load `skills/dekoi-architecture-guard/SKILL.md`.
2. Inspect current callers, contracts, tests, and ownership boundaries.
3. Note friction while reading: bouncing between many files, shallow wrappers,
   forwarding call chains, one-consumer interfaces, unnecessary exports,
   duplicate concepts or terminology, unsupported compatibility paths,
   duplicated conditionals, test-only boundaries, or cross-owner leakage.
4. Apply the deletion and inline tests to suspected shallow modules, wrappers,
   helpers, interfaces, and exported symbols.
5. Write the Markdown candidate report described below before proposing code.
6. If the user picks a candidate, design the new interface and proof plan before
   editing.

## Report Artifact

Write the complete architecture assessment to a Markdown file instead of
placing the candidates in the conversation.

Use the user-specified output path when provided. Otherwise use
`scratch/reports/improve-codebase-architecture-YYYY-MM-DD-HHmmss.md` after
verifying that the path is ignored by Git. If it is not ignored, do not edit
`.gitignore`; use
`<CODEX_HOME>/reports/improve-codebase-architecture/<workspace>-YYYY-MM-DD-HHmmss.md`
instead. If `CODEX_HOME` is unset, use the platform-equivalent `~/.codex`
directory.

Create only the required parent directory. Use a filesystem-safe workspace name
and local time in the filename. Write a report even when no worthwhile
candidates are found.

Structure the report as:

- title, timestamp, target area, baseline, and boundaries inspected
- summary with candidate counts and overall assessment
- prioritized candidate reports
- areas inspected with no worthwhile opportunity
- unresolved contract, ownership, or compatibility questions
- evidence and validation used

In the conversation, return only a link to the report, candidate counts, and any
material inspection or validation limitation. Do not duplicate the candidates.
If the report cannot be written, state the filesystem blocker instead of dumping
the assessment into the conversation.

## Candidate Report

For each candidate, include:

- Files/modules involved
- Current interface cost
- Hidden implementation complexity, if any
- Concepts, layers, or exported symbols the change would remove
- Current consumers or contracts that justify retained compatibility paths
- Proposed interface or owner move
- Benefits in locality, leverage, and testability
- Boundary risks under DeKoi architecture rules
- Recommendation: Strong, Worth exploring, or Speculative

Do not propose feature-level generic routers, fake compatibility layers,
speculative extension points, pass-through wrappers, direct engine-to-Tauri
imports, cross-mode imports, or one-adapter abstractions without a real second
adapter or clear near-term caller.

## Design Pass

When exploring a chosen candidate, compare at least two interface shapes:

- smallest interface with maximum leverage
- common-caller optimized interface
- ports/adapters shape when dependencies cross runtime, storage, provider, or
  host capability boundaries

Pick the shape that concentrates change in the right owner and can be proven
through a stable public interface. If the refactor would cross source lanes,
state the target validation command before editing.

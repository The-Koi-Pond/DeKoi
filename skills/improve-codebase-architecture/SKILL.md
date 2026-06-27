---
name: improve-codebase-architecture
description: "Find DeKoi architecture deepening opportunities that improve locality, leverage, testability, and agent navigation without violating repo boundaries. Use when the user asks to improve architecture, reduce shallow modules, plan refactors, make code more testable, inspect module/interface design, or identify high-value refactor candidates."
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

## Workflow

1. Name the target area and load `skills/dekoi-architecture-guard/SKILL.md`.
2. Inspect current callers, contracts, tests, and ownership boundaries.
3. Note friction while reading: bouncing between many files, shallow wrappers,
   duplicated conditionals, test-only boundaries, or cross-owner leakage.
4. Apply the deletion test to suspected shallow modules.
5. Produce a candidate report before proposing code.
6. If the user picks a candidate, design the new interface and proof plan before
   editing.

## Candidate Report

For each candidate, include:

- Files/modules involved
- Current interface cost
- Hidden implementation complexity, if any
- Proposed interface or owner move
- Benefits in locality, leverage, and testability
- Boundary risks under DeKoi architecture rules
- Recommendation: Strong, Worth exploring, or Speculative

Do not propose feature-level generic routers, fake compatibility layers, direct
engine-to-Tauri imports, cross-mode imports, or one-adapter abstractions without
a real second adapter or clear near-term caller.

## Design Pass

When exploring a chosen candidate, compare at least two interface shapes:

- smallest interface with maximum leverage
- common-caller optimized interface
- ports/adapters shape when dependencies cross runtime, storage, provider, or
  host capability boundaries

Pick the shape that concentrates change in the right owner and can be proven
through a stable public interface. If the refactor would cross source lanes,
state the target validation command before editing.

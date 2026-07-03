---
name: grill-with-docs
description: "Stress-test DeKoi plans against the current repo, product docs, architecture rules, and durable guidance, then capture only reusable decisions. Use when the user wants to be grilled on a design, sharpen fuzzy requirements, validate terminology, choose owners, or update docs while a plan is clarified."
---

# Grill With Docs

Use this skill to reach shared understanding before implementation. Ask one
question at a time. If code or docs can answer the question, inspect them
instead of asking.

This is a local DeKoi port of Xel-authored planning guidance from the previous
repo. It is safe to reuse here, with current DeKoi docs and skill names.

## Load First

- Current session instructions.
- `.github/agents/dekoi-workflow.md`.
- `PRODUCT.md` and `DESIGN.md` when product or UI intent matters.
- `ARCHITECTURE.md` and `DOMAIN_MODEL.md` when source ownership, naming, or
  source provenance boundaries matter.
- `skills/dekoi-architecture-guard/SKILL.md` for ownership, imports, shared
  APIs, Tauri, Rust, storage, providers, or runtime behavior.
- `skills/dekoi-mode-separation/SKILL.md` for Messenger, Roleplay, shared
  generation, ripple state, prompt routing, or mode UI behavior.

## Session Loop

1. Restate the plan in one concise paragraph.
2. Identify the highest-risk unclear decision.
3. Ask one focused question with your recommended answer.
4. Use repo inspection to resolve answerable questions.
5. Challenge fuzzy language against DeKoi terms and owners.
6. Probe concrete scenarios and edge cases.
7. Record only durable decisions that future work needs.
8. Continue until the plan has clear scope, owner, proof, and out-of-scope
   boundaries.

## What To Challenge

- owner confusion between `src/engine`, `src/features`, `src/runtime`,
  `src/shared/api`, and `src-tauri`
- Messenger and Roleplay behavior mixing
- UI-only fixes for engine, storage, provider, runtime, or Tauri contract bugs
- hidden persistence, migration, import/export, prompt, provider, filesystem, or
  security risk
- vague words such as "sync", "memory", "agent", "runtime", "profile", or
  "state" when multiple DeKoi meanings exist
- missing negative controls for destructive, detection, import, or provider
  logic
- source provenance risk from old product language, old storage shapes, copied UI text,
  or legacy concepts becoming native DeKoi models

## Durable Capture

Do not create docs by reflex. Capture decisions only when they change future
agent behavior, architecture, product language, issue clarity, PR clarity, or
acceptance criteria.

Use the narrowest durable home:

- GitHub issue or PR body for active work ownership and acceptance criteria.
- `skills/*/references/*` for reusable agent guidance.
- `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, or `docs/`
  for product or architecture guidance that belongs outside skills.

Do not add AI/tool self-attribution to public text. Draft exact external text
and wait for approval unless posting was already authorized.

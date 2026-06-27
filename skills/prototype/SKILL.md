---
name: prototype
description: "Build throwaway DeKoi prototypes to answer logic, state-model, API-shape, workflow, or UI-layout questions before production implementation. Use when the user asks to prototype, mock up, sanity-check a state model, try UI variants, compare interaction approaches, or let them play with a design."
---

# Prototype

A prototype answers one question quickly, then gets deleted or absorbed into
production code. It is not a shortcut around DeKoi architecture, persistence
safety, source provenance rules, or UI proof.

This is a local DeKoi port of Xel-authored prototype guidance from the previous
repo. It is safe to reuse here, with current DeKoi docs and skill names.

## Pick The Branch

- Logic/state/API question: build a tiny interactive harness or terminal loop
  around a pure reducer, state machine, or small function set.
- UI/layout question: add temporary variants inside the closest existing surface
  when possible, switchable by a clearly named dev-only URL/search-param gate.
- Native/Tauri question: use scratch inputs and a narrow host-capability proof.
  Do not touch real app data unless the user explicitly approves that path.

Ask one focused question only when choosing the branch would change the artifact
and the prompt does not make it clear.

## Rules

1. Mark files and routes as throwaway prototype code.
2. Keep persistence off by default. Use in-memory state unless the question is
   explicitly about persistence.
3. Do not wire prototypes to real destructive mutations or user data.
4. Keep logic portable: pure reducers/state machines must not import React,
   Tauri, storage, browser APIs, or terminal code.
5. Keep UI variants structurally different, not just color or copy tweaks.
6. Hide prototype switchers from production builds.
7. Surface full relevant state after each action or variant switch.
8. Add one command or URL that makes the prototype easy to run.

## DeKoi Placement

- Product logic prototypes live near the likely `src/engine` owner or in a
  temporary harness that imports that owner.
- UI prototypes live under the owning `src/features` surface and must not move
  product behavior into React.
- Runtime prototypes live behind `src/runtime` or `src/shared/api` boundaries.
- Rust/Tauri prototypes use scratch inputs and must not touch real app data
  without explicit approval.

Load `frontend-design` for first-pass UI direction and `impeccable` for critique
or polish only when the prototype is meant to inform a real UI. Load
`webapp-testing` when browser or native proof is needed.

## Closeout

When the question is answered, record the decision in the issue, PR,
architecture/product docs, or final handoff. Then delete losing variants,
throwaway routes, debug commands, and temporary harnesses, or rewrite the winning
logic into production code with normal proof.

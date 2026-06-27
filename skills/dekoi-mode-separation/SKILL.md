---
name: dekoi-mode-separation
description: "Enforce DeKoi's separation between Messenger, Roleplay, shared generation, and shared ripple state. Use when changing mode engines, mode UI, Messenger threads, Roleplay scenes, shared ChatComposer behavior, generation routing, prompt assembly, provider generation workflows, ripple state, storage tied to modes, or any shared code that could affect more than one mode."
---

# DeKoi Mode Separation

## Overview

Use this skill whenever a change touches Messenger, Roleplay, shared generation,
or shared per-thread state. The goal is to keep each product path explicit so a
fix in one mode does not silently change another.

This is a local DeKoi port of MuniMuni-authored Tauri app framework guidance.
It is project-agnostic in origin, but the mode names and owners here are adapted
to this repository.

## Load First

Read `references/mode-impact-map.md` when you need owner paths, allowed sharing,
or impact checks.

Also keep `SURFACE_LABELS.md` in force for public/internal naming and legacy
import boundaries.

## Mode Owners

- Messenger owns direct/group chat thread records, message display, message
  actions, provider-neutral Messenger generation requests, and Messenger-specific
  send/regenerate behavior.
- Roleplay owns roleplay thread records, scene records, cast/world/context
  setup, scene display, scene actions, and Roleplay-specific generation
  behavior.
- Ripples are shared per-thread state, not a third mode. Changes to ripple
  records or workflows must check which mode surfaces can observe them.

## Required Checks

Before editing:

1. Identify the active mode or modes.
2. Identify the mode-owned entry point.
3. Identify lower-layer helpers that are safe to share.
4. Verify no concrete mode imports another concrete mode.
5. Verify shared mode UI receives mode-owned callbacks or lower-layer data, not
   concrete mode orchestration.
6. State whether generation, prompt assembly, storage, ripples, provider
   transport, or UI are also impacted.

After editing:

1. Verify the target mode path.
2. Check sibling modes for accidental behavior changes when a shared layer
   changed.
3. Document the mode impact in the final response.

## Sharing Rules

- Share only lower-layer primitives: record contracts, storage adapters, runtime
  command wrappers, generic transcript helpers, deterministic parsers, generic
  UI atoms, and provider transport wrappers.
- Do not share orchestration, prompts, scene semantics, state transitions, or
  mode-specific generation behavior across modes.
- If two modes need similar behavior, extract a smaller lower-layer primitive
  and keep each mode's orchestration separate.
- Do not add a mode flag to a generic function when a mode-owned service would
  make the behavior explicit.
- If shared mode UI needs concrete Messenger or Roleplay behavior, pass a
  mode-owned callback from the concrete mode surface. Move the UI to the owning
  mode if the shared component starts learning mode orchestration.

## Rejection Rules

Reject fixes that route Messenger through Roleplay, Roleplay through Messenger,
or both modes through one generic prompt/orchestrator with guide strings. That
hides product behavior and makes bugs spread.

Do not treat legacy `conversation`, `chat mode`, `game mode`, or `game state`
names as native DeKoi concepts. Use DeKoi-owned records and product language.

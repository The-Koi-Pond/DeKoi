# Product Notes

## Purpose

DeKoi is a private-first engine for character conversations, scenes, and small
story worlds. It should make local creative play feel approachable while leaving
room for deeper tools when users want them.

## Intended Users

- Friends sharing character chat experiments.
- Writers who want lightweight scene continuity.
- Power users who want local files, provider control, and editable context.
- Nontechnical users who need setup paths that explain themselves.

## First Product Slice

1. Create or import a character.
2. Start a local conversation.
3. Save the chat in a DeKoi-owned format.
4. Reopen the conversation without needing external services.
5. Add provider support behind one focused runtime boundary.

## Design Direction

DeKoi should feel calm, intimate, and handmade. It can use water, paper, ink,
coral, and soft light as motifs, but the interface still needs to be readable,
fast, and touch-friendly.

## Non-Goals

- Do not chase feature parity before the core loop exists.
- Do not ship a compatibility clone.
- Do not expose internal provider or storage complexity as the default user
  experience.
- Do not use another project's mascot, names, or UI voice.

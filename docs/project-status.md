# Project Status

DeKoi is an early seed for a private-first story and character engine. The current repository proves the first native app shape and runtime boundaries; it is not a full replacement for older fork-derived work.

## Works Now

- React and TypeScript app shell built with Vite.
- Native product records for Messenger, Roleplay, companions, personas, lorebooks, provider connections, and Ripples.
- Collection-backed storage entity registry and Rust allowlist checks, including
  split Messenger message and Roleplay entry collections.
- DeKoi-native bundle import and export paths through the desktop host, with
  preview, explicit confirmation, pre-import backup, and commit-path collection
  replacement.
- Provider-key secret commands through the desktop host.
- Remote runtime fixture and HTTP invoke contract for storage, provider checks,
  model listing, and generation commands.
- Desktop runtime bridge for durable app-data storage and narrow provider-backed
  generation.
- Provider-backed generation notices in Messenger and Roleplay format common
  failures into actions for API keys, Base URL, selected model, provider support,
  and network reachability while preserving provider refusal/error detail.
- Messenger and Roleplay settings surface no-active-thread, empty-catalog, and
  missing connection/persona/companion/lorebook states with narrow recovery
  actions through mode-native records.
- Messenger and Roleplay thread surfaces expose thread settings, pre-send
  missing-reference notices, and touch-friendly confirmation-aware edit/delete
  message or entry actions.
- Roleplay thread settings now update thread name, connection, persona,
  companions, and lorebooks through Roleplay-native records, while exposing the
  shared advanced generation drawer in the Roleplay settings rail.
- Desktop collection metadata checks and explicit storage reload from Pond Care,
  with reload blocked while local saves are pending.
- Pond Care storage repair for malformed desktop collections, using explicit
  Tauri commands, backup restore or empty replacement, and a separate finish
  action for `.json.pre-repair` sidecars.
- One-way legacy thread import into native Messenger records.

## Experimental Or Incomplete

- Provider transport is still narrow and experimental; required-key providers
  use desktop provider-key storage through the runtime boundary, and
  provider-specific response parsing still needs more real-endpoint validation.
- Runtime generation routing is not fully symmetric yet: desktop uses the
  desktop runtime provider path, while browser mode has a direct provider
  fallback and remote-runtime command paths for storage/check/model commands.
- Roleplay now has native thread settings and send guards, but deeper
  scene-specific semantics, media, and visual-novel presentation remain early.
- Ripples have engine records, actions, persistence, and bundle support, but no
  dedicated routed editor surface yet.
- Media and preset rails are placeholder-only.
- Legacy thread import is an explicit one-way adapter into native Messenger
  records; automatic browser-storage migration remains out of scope.
- Storage is collection-backed first; a database may replace the implementation later only behind the same record contracts.

## Current Priorities

Build in this order unless the active task redirects:

1. Harden provider connection UX and provider-backed generation errors.
2. Polish Messenger and Roleplay thread settings, send/edit/delete, and
   missing-reference UX.
3. Deepen Roleplay-specific scene semantics while keeping mode records separate.
4. Harden catalog validation, deletion cleanup, and empty states.
5. Keep bundle import/export, legacy import, desktop storage repair, and runtime
   contracts reliable as storage changes.
6. Keep docs current when implementation paths or product status change.

## Intentionally Out Of Scope For Now

- Feature parity with the old dashed project line.
- Copying old code, assets, docs, prompts, schemas, UI text, or layouts.
- Treating legacy record names as native DeKoi concepts.
- Game/adventure-style play as a first product slice.
- Browser storage as the durable app-record store.
- Provider secrets inside exported DeKoi bundles.

## Near-Term Documentation Needs

- Convert `DOMAIN_MODEL.md` fully into a stable product-language glossary, or
  merge its durable record details into `docs/storage-model.md` and
  `ARCHITECTURE.md`.
- Add screenshots or short walkthroughs once the first user loop is stable enough to document visually.
- Keep README status current as provider transport and legacy import become real features.

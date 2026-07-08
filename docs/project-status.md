# Project Status

DeKoi is an early seed for a private-first story and character engine. The current repository proves the first native app shape and runtime boundaries; it is not a full replacement for older fork-derived work.

## Works Now

- React and TypeScript app shell built with Vite.
- Native product records for Messenger, Roleplay, companions, personas,
  lorebooks, prompt presets, lore runtime states, macro variable scopes,
  provider connections, and Ripples.
- Lorebooks use a native `schemaVersion: 2` storage/action foundation for
  activation settings and entry-level activation, inclusion, placement,
  trigger, filter, timing, match-source, and budget fields.
- Lorebook prompt assembly resolves chat/thread, active-persona,
  selected-companion, and global app-setting lorebook sources with deterministic
  first-source precedence, activates enabled constant entries unless blocked by
  timing delay or delayed until recursion, selective primary-key entries from
  recent Messenger or Roleplay transcript text, per-entry opted-in
  companion/persona match sources, optional filter logic, and regex keys,
  recursively scans macro-resolved activated entry bodies when enabled, surfaces
  invalid or unsafe regex and runaway recursion warnings, applies timed
  delay/cooldown/sticky effects through per-thread lore runtime state, resolves
  inclusion groups, applies probability gates after group winners are selected
  while sticky activations bypass inclusion-group suppression and probability,
  orders activated entries by insertion order using the saved insertion
  strategy, places them before character context, after character context, or at
  transcript depth, commits variable macro mutations only from kept prompt-order
  lore text, and applies lorebook budget caps with direct activations prioritized
  before recursive activations, constants before selective entries within each
  direct/recursive group, prompt-order variable preview recomputation, and a
  cheap text-length estimate of macro-resolved summaries and bodies.
- Lorebook catalog controls expose scan depth, budget tokens or percent, entry
  Strategy/Key, Optional Filter, Selective Logic, Additional matching sources,
  Include names, case-sensitive and whole-word matching, insertion order,
  insertion position, recursive scan, max recursion steps, group scoring,
  per-entry probability, inclusion groups, group weight, insertion-order group
  resolution, per-entry recursion and timed-effect controls, regex-key hints,
  and at-depth depth/role.
- Presets catalog controls expose prompt preset title, summary, system prompt,
  Messenger Prompt Source, optional temperature, `topP`, and max-token sampling,
  with create, edit, duplicate, and delete actions plus an editable starter
  preset.
- Companion and Persona editors can attach lorebooks, and Pond Care generation
  settings can attach global lorebooks and choose `sorted-evenly`,
  `character-first`, or `global-first` insertion.
- Collection-backed storage entity registry and Rust allowlist checks, including
  prompt presets, split Messenger message and Roleplay entry collections,
  per-thread lore runtime states, and global and per-thread macro variable
  states.
- DeKoi-native bundle import and export paths through the desktop host, with
  preview, explicit confirmation, pre-import backup, and commit-path collection
  replacement, including prompt presets plus lore runtime state and macro
  variable state cleanup for missing owner threads.
- Provider-key secret commands through the desktop host.
- Remote runtime fixture and HTTP invoke contract for storage, provider checks,
  model listing, and generation commands.
- Desktop runtime bridge for durable app-data storage and narrow provider-backed
  generation.
- Provider-backed generation notices in Messenger and Roleplay format common
  failures into actions for API keys, Base URL, selected model, provider support,
  and network reachability while preserving provider refusal/error detail.
- Remote runtime health, remote invoke, and direct provider network paths have
  bounded timeouts, including stalled response-body reads; remote runtime health
  failures surface sanitized timeout or fetch diagnostics in Pond Care.
- Current built-in generation macro semantics, including variable macro
  transactions, are documented and implemented as a pure TypeScript resolver
  under `src/engine/generation-core/macros`, with Messenger and Roleplay prompt
  assembly wiring in `src/engine/generation` and successful-generation
  persistence through owner-scoped macro variable state. The engine also exports
  active macro metadata for editor UI, and macro-resolved catalog text areas can
  browse and insert supported macro syntax. Companion and Persona macro editors
  show scratch live previews where their local draft context is available.
- Messenger and Roleplay settings surface no-active-thread, empty-catalog, and
  missing connection/persona/companion/lorebook/prompt-preset states, including
  lorebooks referenced through chat, persona, companion, or global sources, with
  narrow recovery actions through mode-native records.
- Messenger and Roleplay thread surfaces expose thread settings, pre-send
  missing-reference notices, and touch-friendly confirmation-aware edit/delete
  message or entry actions.
- Roleplay thread settings now update thread name, connection, persona,
  companions, lorebooks, and prompt preset through Roleplay-native records,
  while exposing the shared advanced generation drawer in the Roleplay settings
  rail.
- Desktop collection metadata checks and explicit storage reload from Pond Care,
  with reload blocked while local saves are pending.
- Pond Care storage repair for malformed desktop collections, using explicit
  Tauri commands, backup restore or empty replacement, and a separate finish
  action for `.json.pre-repair` sidecars.
- Pond Care dropped-record warnings when storage load skips unreadable records,
  with save blocking for affected collections until reload or import/restore
  clears the count.
- One-way legacy import into native companion, persona, provider connection,
  Messenger, and macro variable scope records, including preview counts and
  same-name global macro variable overwrite warnings.

## Experimental Or Incomplete

- Provider transport is still narrow and experimental; required-key providers
  use desktop provider-key storage through the runtime boundary. Provider
  response parsing has shared TypeScript/Rust parity fixtures, but still needs
  more real-endpoint validation.
- Macro resolver wiring is active in Messenger and Roleplay prompt assembly for
  current built-in identity, context, time, formatting, comment, control-flow,
  random, dice, and variable macros. Dynamic variable storage is persisted for
  global, Messenger thread, and Roleplay thread scopes. The old deferred
  character-macro second pass is not needed for the current selected-speaker
  architecture; reopen it only if prompt assembly must resolve shared text
  before a target companion is known.
- Messenger and Roleplay generation now use provider transport directly:
  desktop uses the desktop runtime provider path, browser mode has a direct
  provider fallback, and remote-runtime command paths remain for storage,
  provider checks, and model listing.
- Roleplay now has native thread settings and send guards, but deeper
  scene-specific semantics, media, and visual-novel presentation remain early.
- Lorebook triggers and character filters are normalized and stored, but
  activation behavior and advanced UI for those fields are not implemented yet.
- Ripples have engine records, actions, persistence, and bundle support, but no
  dedicated routed editor surface yet.
- Media rails are placeholder-only.
- Legacy import is an explicit one-way adapter into native DeKoi records;
  automatic browser-storage migration remains out of scope.
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

- Feature parity with the older De-Koi line.
- Anything barred by [PROVENANCE.md](../PROVENANCE.md): AGPLv3-derived
  material and legacy record names as native DeKoi concepts.
- Game/adventure-style play as a first product slice.
- Browser storage as the durable app-record store.
- Provider secrets inside exported DeKoi bundles.

## Near-Term Documentation Needs

- Keep `DOMAIN_MODEL.md` a stable product vocabulary and record glossary;
  field-level storage and activation mechanics belong in
  `docs/storage-model.md`.
- Add screenshots or short walkthroughs once the first user loop is stable enough to document visually.
- Keep README status current as provider transport and legacy import become real features.

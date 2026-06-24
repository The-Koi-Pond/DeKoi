# Storage Model

This document is the storage guardrail for DeKoi-native records. It is not a SQL
migration plan. The goal is to keep durable data shaped by product ownership
before the app grows enough to need a heavier database implementation.

## Decision

DeKoi storage is collection-backed first.

Current desktop storage writes JSON arrays under:

```text
<app-data>/collections/<entity>.json
```

Remote runtimes expose the same entities through explicit storage commands:

- `storage_list`
- `storage_create`
- `storage_update`
- `storage_delete`

If DeKoi later uses SQLite or another database, that database is an
implementation detail behind the same DeKoi record contracts. It should not
leak table-driven names into UI, engine records, provider requests, or import
adapters.

## Current Collections

| Entity | Native owner | Record |
| --- | --- | --- |
| `app-settings` | `src/runtime/app-settings.ts` | `AppSettings` |
| `characters` | `src/engine/character.ts` | `CharacterRecord` |
| `classic-threads` | `src/engine/classic.ts` | `ClassicThread` |
| `lorebooks` | `src/engine/lorebook.ts` | `LorebookRecord` |
| `messenger-threads` | `src/engine/messenger.ts` | `MessengerThread` |
| `personas` | `src/engine/persona.ts` | `PersonaRecord` |
| `provider-connections` | `src/engine/provider-connection.ts` | `ProviderConnectionRecord` |
| `ripple-states` | `src/engine/ripples.ts` | `RippleState` |

## Source Of Truth

The current collection allowlist exists in two places and should be collapsed
into an explicit checked contract:

- frontend: `src/runtime/host-storage.ts`
- desktop host: `src-tauri/src/lib.rs`

Until that registry exists, any collection change must update both sides and
this document in the same change.

## Record Rules

- Every durable product record uses a DeKoi-owned noun.
- Every durable product record carries `id`, `schemaVersion`, `createdAt`, and
  `updatedAt` unless the record is explicitly documented as singleton settings.
- Each collection has one native owner. UI code may request changes, but it does
  not define the durable shape.
- Runtime adapters may normalize unknown JSON into native records, but they do
  not invent product meaning.
- Provider-specific metadata stays out of core thread/message records unless it
  is wrapped in a DeKoi-owned field with a documented purpose.
- Provider secrets are not ordinary collection data and must not be exported in
  DeKoi bundles.

## Relationship Rules

Relationships are stored as IDs. Cleanup is implemented by the owner action or
storage adapter, not by UI components.

Current relationships:

| From | Field | Points to | Cleanup expectation |
| --- | --- | --- | --- |
| `messenger-threads` | `characterIds[]` | `characters.id` | Deleted characters are removed from thread participants. |
| `messenger-threads` | `activePersonaId` | `personas.id` | Deleted personas clear the active persona. |
| `messenger-threads` | `lorebookIds[]` | `lorebooks.id` | Deleted lorebooks are removed from thread context. |
| `messenger-threads` | `providerConnectionId` | `provider-connections.id` | Deleted connections clear the selected connection. |
| `classic-threads` | `characterIds[]` | `characters.id` | Deleted characters are removed from scene participants. |
| `classic-threads` | `activePersonaId` | `personas.id` | Deleted personas clear the active persona. |
| `classic-threads` | `lorebookIds[]` | `lorebooks.id` | Deleted lorebooks are removed from scene context. |
| `classic-threads` | `providerConnectionId` | `provider-connections.id` | Deleted connections clear the selected connection. |
| `characters` | `lorebookIds[]` | `lorebooks.id` | Deleted lorebooks are removed from character context. |
| `ripple-states` | `ownerId` | `messenger-threads.id` or `classic-threads.id` | Orphaned ripple states are skipped on bundle import. |

## Import And Export

DeKoi-native bundle import/export is the durable interchange path. It should:

- Validate bundle kind and schema version.
- Normalize each collection independently.
- Preview counts before replacing local data.
- Skip invalid records with clear warnings when possible.
- Keep legacy import separate from native bundle import.
- Keep provider secret values outside exported JSON.

Legacy import remains one-way:

```text
legacy source record -> DeKoi native record
```

Import adapters may understand old source names. Engine records, collection
names, UI labels, and provider requests should stay DeKoi-native.

## Next Storage Work

1. Create a shared TypeScript storage entity registry for entity names and
   expected record owners.
2. Generate or check a storage catalog from the frontend registry and desktop
   host allowlist.
3. Add narrow cleanup helpers for relationships that are currently cleaned by
   higher-level UI flows.
4. Split desktop host storage commands out of `src-tauri/src/lib.rs` before
   adding more privileged capabilities.

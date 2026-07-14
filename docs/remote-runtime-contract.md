# Remote Runtime Contract

DeKoi can talk to a local or remote runtime through a small HTTP contract. This
is intentionally provider-neutral: DeKoi sends native records and the runtime
decides how to generate, store, or transport them.

## Development Fixture

Start the local fixture:

```sh
pnpm runtime:fixture
```

Default URL:

```text
http://127.0.0.1:7341
```

Use that URL in Pond Care > Data & Backup > Remote Runtime URL. The fixture keeps
storage in memory, so records disappear when the fixture process stops.

Optional host and port:

```sh
pnpm runtime:fixture -- --host 127.0.0.1 --port 7342
```

This fixture is the standalone HTTP contract harness. Browser e2e specs use the
separate Playwright fake runtime in `tests/e2e/app-test-utils.ts`, which
intercepts `http://dekoi-runtime.test/api/invoke` in-process and can
simulate normal, failing, and deferred storage commands without starting this
server.

## Health

DeKoi probes:

```http
GET /health?probe=1
```

Compatible response:

```json
{
  "ok": true,
  "runtime": "de-koi-server",
  "writable": true
}
```

The Tauri desktop host uses `de-koi-desktop` internally when Pond Care selects
the desktop runtime.

Remote HTTP health probes are intentionally short. DeKoi times them out after
5 seconds, reads the JSON body only for 2xx responses, reports non-2xx responses
as unreachable with their status, treats malformed successful JSON as
unreachable, and reports successful JSON with incompatible markers as an
incompatible health response.
Transport-level failures, including fetch failures and the 5 second timeout, are
also reported as unreachable in Pond Care with sanitized error detail appended.
DeKoi redacts bearer/basic Authorization header values and URL userinfo before
surfacing that detail.

## Desktop Runtime

Inside the Tauri app, Pond Care > Data & Backup can select:

```text
desktop://runtime
```

This does not start an HTTP server. It routes the same runtime command names
through Tauri commands:

- `dekoi_runtime_health`
- `dekoi_runtime_invoke`

The desktop runtime currently provides durable collection storage under the app
data directory at:

```text
<app-data>/collections/<entity>.json
```

Desktop collection files are JSON arrays. Missing files load as empty
collections only when no `.json.bak`, legacy `.json.tmp`, unique
`.json.write-*.tmp`, or `.json.pre-repair` recovery sibling is present.
Malformed files and missing files with recovery artifacts return recoverable
storage errors instead of being overwritten by normal autosave. Desktop
collection writes use an atomically allocated, synced temp file and preserve the
previous readable file as `<entity>.json.bak`; storage bundle writes use the
temp/sync path without creating a backup.

If a readable desktop file or remote `storage_list` response contains individual
records DeKoi cannot normalize, DeKoi loads the accepted records and counts the
rejected records locally. Pond Care shows one dropped-records warning and DeKoi
blocks automatic replacement for the unified `mode-threads`/`mode-messages`
safety group until reload or import/restore loads without drops. Operations
changing both projections schedule both; one-projection edits may save only that
projection, with sequential writes and explicit partial-failure reporting.

When one or more collection loads fail, DeKoi keeps every per-collection error
message while preserving the first error as the aggregate storage result for
compatibility. Pond Care lists all failed collections for both desktop and
remote targets without requiring desktop repair metadata. A failed manual
reload retains the last good in-memory records; a healthy retry clears the
collection alerts.

Malformed-collection repair is desktop-only and not part of the remote runtime
HTTP contract. Pond Care uses dedicated Tauri commands to repair one collection
at a time with explicit confirmation. Repair supports `restore-backup` and
`replace-empty`, preserves existing `.json.bak` backups, saves malformed bytes
as `.json.pre-repair`, and requires a separate finish action before removing
that sidecar.

Desktop stale checking uses the separate `dekoi_storage_collection_metadata`
Tauri command to compare collection file existence, byte length, updated-at
milliseconds, and content hash against the last loaded or app-written snapshot.
That metadata also reports recovery artifact state, whether a backup is
restorable, and whether the collection state is repairable. Whole-directory
checks include known DeKoi collections and extra collection-like files so Pond
Care can surface unknown future entities.
Remote HTTP runtimes do not need to implement this metadata path; DeKoi reports
stale-check metadata as unavailable for remote targets and still supports
explicit reload through the normal storage commands. Missing or unavailable
metadata is not treated as an empty fresh baseline; stale checks only compare
against metadata captured from a loaded snapshot, a completed import, or a
successful collection write.

It also provides provider-backed generation through the same command envelope.

## Invoke Envelope

All runtime commands use:

```http
POST /api/invoke
Content-Type: application/json
X-DeKoi-CSRF: 1
```

Request envelope:

```json
{
  "command": "generation_generate",
  "args": {}
}
```

Error response:

```json
{
  "message": "Remote runtime returned a clear error."
}
```

Remote HTTP calls are bounded: health probes use a 5 second timeout,
non-generation invoke commands use a 30 second timeout, and
`generation_generate` uses a 120 second timeout. The timeout covers both the
request and JSON response-body read.

The browser adapter treats any non-2xx `/api/invoke` response as a runtime
error and surfaces the message in the active chat surface. A readable JSON
`message` field is used when present; when a non-2xx body is missing or not
readable as JSON, DeKoi falls back to the HTTP status. Successful 2xx invoke
responses must have a readable JSON body. Provider-backed generation errors
should keep actionable provider detail, such as nested `error.message`,
`error.detail`, `error.type`, `error.code`, or the HTTP status. DeKoi formats
common failures into user actions for API keys, Base URL, selected model,
unsupported providers, and network reachability.

## Commands

The explicit DeKoi allowlist currently contains:

- `generation_generate`
- `provider_connection_check`
- `provider_connection_models`
- `storage_list`
- `storage_replace`
- `storage_create`
- `storage_update`
- `storage_delete`

Generation and storage commands must remain separately named. Do not overload
`generation_generate` to persist messages or overload storage commands to run
generation.

The TypeScript command registry is `src/shared/api/runtime-commands.ts`. Run this
after changing the command list:

```sh
pnpm check:runtime-contracts
```

## Provider Connection Commands

`provider_connection_check` validates a configured provider endpoint and model:

```json
{
  "command": "provider_connection_check",
  "args": {
    "connection": {
      "id": "connection-openai",
      "provider": "openai",
      "apiKey": "<typed key for this check>",
      "baseUrl": "https://api.openai.com/v1",
      "model": "gpt-4o-mini",
      "status": "needs-key"
    }
  }
}
```

Compatible response:

```json
{
  "success": true,
  "message": "API key is valid and the selected model can generate."
}
```

Compatible runtimes should return this success only after confirming the
provider can generate text for the selected model. The built-in desktop checker
sends a minimal generation request and rejects empty, malformed, or provider
shape-incompatible successful provider bodies instead of treating them as a
valid connection.

`provider_connection_models` lists model IDs for a configured provider endpoint:

```json
{
  "command": "provider_connection_models",
  "args": {
    "connection": {
      "id": "connection-openai",
      "provider": "openai",
      "apiKey": "<typed key for this fetch>",
      "baseUrl": "https://api.openai.com/v1",
      "status": "needs-key"
    }
  }
}
```

Compatible response:

```json
{
  "models": ["gpt-4o-mini", "gpt-4o"]
}
```

Connection check and model-list requests may include a freshly typed `apiKey`
so the app can validate a draft before saving. Durable provider connection rows
do not contain saved keys. The desktop runtime may resolve a saved key by
`connection.id` only when the connection is `ready` and the saved key scope still
matches the connection provider and base URL. Remote HTTP runtimes should not
infer saved secrets from DeKoi storage records.

The built-in direct provider paths currently support `openai`, `anthropic`,
`google`, `mistral`, `cohere`, `openrouter`, `nanogpt`, `xai`, and `custom`.
The desktop runtime uses that matrix for provider checks, model listing,
generation request shaping, and response extraction; the browser fallback uses
it for generation request shaping and response extraction. `mistral`, `cohere`,
`openrouter`, `nanogpt`, `xai`, and `custom` use the OpenAI-compatible chat
completions path. Non-direct aliases such as `openai_chatgpt`,
`claude_subscription`, and `google_vertex` are valid provider connection record
values, but the built-in direct provider adapter rejects them until a dedicated
transport exists. A remote HTTP runtime may still implement its own
`generation_generate` behavior for any provider value as long as it returns the
normalized DeKoi response shape below.

Built-in direct provider checks and model listing use a 30 second timeout.
Built-in direct provider generation uses a 120 second timeout in both the
desktop runtime and the browser fallback. Successful provider responses must be
readable JSON. Empty or malformed successful bodies fail the request; non-2xx
provider responses may be empty, but DeKoi still preserves the HTTP status in
the surfaced error.

For built-in direct generation, OpenAI-compatible response extraction is
`choices`-first. When a successful response contains a `choices` array, DeKoi
uses `choices[].message.content` or `choices[].text` and ignores generic
top-level fields such as `message`, `text`, or `output_text`. The generic text
extractor is used only when an OpenAI-compatible generation response has no
`choices` array.

For built-in `provider_connection_check`, OpenAI-compatible providers other
than `custom` must return generated text in `choices[].message.content` or
`choices[].text`; Anthropic must return text under `content`; Google must
return text under `candidates[].content`. `custom` keeps the generic text
extractor so local OpenAI-compatible services can expose simpler response
shapes during checks. A generic top-level `message` or `text` field does not
prove a valid OpenAI, Anthropic, or Google connection check.

## `generation_generate`

The request may carry Messenger or Roleplay native fields for local context.
Runtimes should use the shared generation fields for provider calls:
`providerConnection`, `targetCharacterId`, `targetCharacterName`,
`promptMessages`, and `parameters`.

DeKoi owns generation macro resolution in app-side prompt assembly; see
[Generation Macro Semantics](./generation-macro-semantics.md). Runtimes should
treat `promptMessages` as the final provider input and must not re-run macro
resolution or interpret unresolved macro-looking text. This includes current
built-in macros in Messenger and Roleplay system prompts, selected prompt
preset system prompts, selected Messenger preset prompt sources, prompt-preset
static and choice variables, selected Roleplay prompt preset sections and
markers, Roleplay scene setup, persona and character context fields,
post-history instructions, lorebook summaries and bodies, at-depth lore, and
example dialogue. It also includes request-local variable macro side effects:
DeKoi commits only the variable mutations that survive app-side prompt
formatting, then sends the final `promptMessages`.

Request:

```json
{
  "command": "generation_generate",
  "args": {
    "request": {
      "schemaVersion": 1,
      "id": "generation-request-example",
      "createdAt": "2026-06-24T07:20:00.000Z",
      "thread": {
        "id": "mode-thread-example",
        "schemaVersion": 1,
        "kind": "messenger",
        "title": "Example Messenger",
        "activeBranchId": "branch-example",
        "branches": [
          {
            "id": "branch-example",
            "schemaVersion": 1,
            "threadId": "mode-thread-example",
            "kind": "messenger",
            "participantMode": "direct",
            "characterIds": ["character-koi"],
            "activePersonaId": "persona-xel",
            "lorebookIds": [],
            "presetId": null,
            "presetChoiceSelectionsByPresetId": {},
            "providerConnectionId": "connection-local-provider",
            "systemPromptMode": "default",
            "systemPrompt": "",
            "createdAt": "2026-06-24T07:10:00.000Z",
            "updatedAt": "2026-06-24T07:20:00.000Z"
          }
        ],
        "messages": [],
        "createdAt": "2026-06-24T07:10:00.000Z",
        "updatedAt": "2026-06-24T07:20:00.000Z"
      },
      "userMessage": {
        "id": "messenger-message-user",
        "schemaVersion": 1,
        "threadId": "mode-thread-example",
        "branchId": "branch-example",
        "author": {
          "kind": "persona",
          "personaId": "persona-xel",
          "label": "Xel"
        },
        "versions": [
          {
            "id": "messenger-message-user-v1",
            "body": "Can you hear me?",
            "origin": "manual",
            "createdAt": "2026-06-24T07:20:00.000Z",
            "updatedAt": "2026-06-24T07:20:00.000Z"
          }
        ],
        "activeVersionId": "messenger-message-user-v1",
        "createdAt": "2026-06-24T07:20:00.000Z",
        "updatedAt": "2026-06-24T07:20:00.000Z"
      },
      "companions": [
        {
          "id": "character-koi",
          "schemaVersion": 1,
          "displayName": "Koi",
          "nickname": "Koi",
          "description": "Used for remote runtime contract checks.",
          "personality": "A local test companion.",
          "scenario": "Koi is helping test the remote runtime contract.",
          "firstMessage": "Fixture check ready.",
          "alternateGreetings": [],
          "groupOnlyGreetings": [],
          "exampleMessages": "<START>\n{{user}}: Can you hear me?\n{{char}}: Fixture channel is clear.",
          "systemPrompt": "",
          "postHistoryInstructions": "",
          "creator": "DeKoi",
          "characterVersion": "contract",
          "creatorNotes": "Used for remote runtime contract checks.",
          "tags": ["fixture"],
          "characterNote": "",
          "characterNoteDepth": 4,
          "characterNoteRole": "system",
          "talkativeness": 50,
          "avatarUrl": null,
          "lorebookIds": [],
          "createdAt": "2026-06-24T07:00:00.000Z",
          "updatedAt": "2026-06-24T07:00:00.000Z"
        }
      ],
      "activePersona": {
        "id": "persona-xel",
        "schemaVersion": 1,
        "displayName": "Xel",
        "nickname": "Xel",
        "description": "Used for remote runtime contract checks.",
        "personality": "The active user persona.",
        "scenario": "Xel is testing a remote runtime request.",
        "systemPrompt": "",
        "postHistoryInstructions": "",
        "creator": "DeKoi",
        "characterVersion": "contract",
        "creatorNotes": "Used for remote runtime contract checks.",
        "tags": ["fixture"],
        "characterNote": "",
        "characterNoteDepth": 4,
        "characterNoteRole": "system",
        "talkativeness": 50,
        "avatarUrl": null,
        "lorebookIds": [],
        "createdAt": "2026-06-24T07:00:00.000Z",
        "updatedAt": "2026-06-24T07:00:00.000Z"
      },
      "lorebooks": [],
      "providerConnectionId": "connection-local-provider",
      "providerConnection": {
        "id": "connection-local-provider",
        "schemaVersion": 1,
        "kind": "provider",
        "provider": "custom",
        "label": "Local OpenAI-compatible provider",
        "baseUrl": "http://127.0.0.1:1234/v1",
        "model": "local-model",
        "summary": "",
        "status": "ready",
        "modelLabel": null,
        "agentDefault": false,
        "maxContext": null,
        "maxOutput": 1024,
        "createdAt": "2026-06-24T07:00:00.000Z",
        "updatedAt": "2026-06-24T07:00:00.000Z"
      },
      "targetCharacterId": "character-koi",
      "targetCharacterName": "Koi",
      "promptMessages": [
        {
          "role": "system",
          "content": "You are Koi, replying naturally to Xel."
        },
        {
          "role": "user",
          "content": "Xel: Can you hear me?"
        }
      ],
      "parameters": {
        "temperature": 0.8,
        "maxTokens": 1024,
        "topP": 0.95
      },
      "warnings": []
    }
  }
}
```

Response:

```json
{
  "schemaVersion": 1,
  "requestId": "generation-request-example",
  "source": "remote-runtime",
  "createdAt": "2026-06-24T07:20:00.000Z",
  "messages": [
    {
      "characterId": "character-koi",
      "body": "Fixture reply from Koi."
    }
  ],
  "warnings": []
}
```

`messages[].characterId` must match a selected companion in the request. DeKoi
drops unknown companion drafts and surfaces a warning.

`source` identifies who produced the normalized generation response. Compatible
remote HTTP runtimes return `"remote-runtime"`; DeKoi's built-in desktop and
browser provider transport returns `"provider-transport"`. This field is
generation response metadata and is separate from provider connection records,
which use `kind: "provider"`.

`request.warnings` contains non-fatal DeKoi-side context and lore activation
warnings discovered before the runtime call, such as invalid or unsafe regex
keys that fell back to plaintext or recursive lore activation stopped by the
hard pass cap. Runtimes do not need to echo these warnings; DeKoi surfaces
runtime response warnings first, then unknown companion draft warnings, then
`request.warnings`.

When a runtime returns no generated text because the provider refused or blocked
the response, return a warning that includes the provider detail. Desktop and
browser OpenAI-compatible parsing preserve refusal text inside the first choice,
including a direct `refusal`, a message refusal, a refusal content part, or a
refusal nested under common content, parts, message, response, output, results,
or data fields. If an OpenAI-compatible response has a `choices` array but no
generated text, DeKoi surfaces the choice `finish_reason` or empty-response
warning instead of treating top-level metadata as generated text. The built-in
adapters also surface provider-specific empty-response warnings for Anthropic
`stop_reason`, Google `promptFeedback.blockReason`, and Google candidate
`finishReason` values.

Provider response extraction parity is guarded by
`test-fixtures/provider-response-parity.json` with `schemaVersion: 1`. Update
that fixture when adding supported response shapes or changing empty-response
warning text; both the TypeScript browser adapter and Rust desktop adapter read
the same fixture.

Provider connection records in generation requests do not include saved API key
material. Desktop generation resolves saved keys through the desktop provider
secret store by connection id. Remote runtimes that need saved secrets should
use a separate secret capability rather than storage records or generation
payload fields.

## Storage Commands

Supported storage entities:

- `app-settings`
- `characters`
- `mode-threads`
- `mode-messages`
- `lorebooks`
- `prompt-presets`
- `lore-runtime-states`
- `macro-variable-states`
- `personas`
- `provider-connections`
- `ripple-states`

Unsupported or legacy entity names are rejected by DeKoi runtimes; compatibility
for old storage names stays in the one-way import adapter or TypeScript record
normalizers, not in extra runtime entities.

The browser app does not persist these entities in browser storage. If the app
is not running in Tauri, configure a Remote Runtime URL before expecting durable
storage.

Storage records must use DeKoi-native field names. Remote runtimes should not
depend on compatibility aliases such as catalog `name`, `shortName`, or
`summary` fields, provider `name` or `url`, or removed provider kinds such as
`mock`; those are handled only by the one-way legacy import adapter, not by
normal `storage_list` or `storage_replace` normalization.
Legacy `globalVariables` and Messenger thread `variables` are likewise converted
only by Pond Care's one-way legacy import into `macro-variable-states`;
compatible runtimes should not expose those legacy fields in normal records.

Mode transcript storage uses one native pair. `mode-threads` records are
metadata projections and complete transcript items live in `mode-messages` with
`schemaVersion: 1`, `threadId`, and `branchId`; DeKoi assembles the pair into
unified mode threads. A thread has
`kind`, non-empty `branches`, and `activeBranchId`; each branch has its own
`systemPromptMode`/`systemPrompt` and context settings. Messages have an author
kind discriminator, complete version records, and an `activeVersionId`.
Thread and message records form one replacement safety group: a rejected record
in either collection blocks automatic replacement of both. Operations that
change both projections request both saves. The current protocol still replaces
collections individually, so runtimes must report partial failure precisely;
DeKoi reloads the durable result and offers its explicit backup/restore path.
Thread records may carry `presetChoiceSelectionsByPresetId`;
runtimes should preserve that per-preset history map with the thread metadata.
Each history is keyed by stable choice-block ID. Each value is
an option object such as `{ "kind": "option", "optionId": "tone-soft" }`, or
an ordered array of those objects for multi-select blocks. For histories whose
preset still exists, DeKoi prunes unknown block IDs and repairs invalid confirmed
values to preset defaults and then valid block options, but unanswered blocks
are not materialized. Histories for inactive or missing preset IDs remain
round-trippable. The removed `presetChoiceSelections` field is accepted only for
one-way migration into an absent active-preset history. Prompt preset
`defaultChoices` separately retain the compatible package shape keyed by
variable name, including string values. Runtimes should round-trip native thread option objects so empty
or duplicate option values keep their option identity. Native loading does not
create aliases or tombstones for removed IDs; repaired thread rows are written
back through the normal collection path. DeKoi assembles thread
records with their transcript items before rendering or generating. Embedded
transcript data is accepted only by the one-way legacy importer; normal remote
storage reads and writes use the native pair exclusively.

`app-settings` records include `globalLorebookIds` and `loreInsertionStrategy`
for generation-wide lore context. `globalLorebookIds` stores trimmed unique
lorebook IDs; `loreInsertionStrategy` is `sorted-evenly`, `character-first`, or
`global-first`. `defaultPromptPresetId` is the sole native prompt-preset default
authority and is repaired to the first usable preset when missing or dangling.
New Messenger and Roleplay threads use it. `promptPresetStarterInitialized`
records that starter initialization occurred; it does not prevent recovery of a
cleanly loaded empty prompt-preset collection.

`prompt-presets` records use `schemaVersion: 1`. Each record stores a non-empty
`title`, optional `summary`, required non-empty `systemPrompt`, optional
`messengerPrompt`, normalized `parameters`, a `sampling` projection with
`temperature`, `topP`, and `maxTokens`, ordering fields, `sections`, `groups`,
`choiceBlocks`, static `variableValues`, `defaultChoices`, and optional
author/folder metadata. Native prompt preset records do not carry a default
flag. DeKoi drops invalid parameter and sampling
fields during normalization. Current generated requests consume the sampling
projection, and cap preset `maxTokens` to the selected provider connection's
positive `maxOutput` when one is configured. Messenger uses `messengerPrompt`
as its selected-preset source when present, then falls back to `systemPrompt`.
A non-empty custom Messenger Prompt still overrides the selected preset at
generation time and Messenger does not consume prompt preset sections. Roleplay
consumes enabled sections and adjacent enabled groups for prompt assembly when a
selected preset has sections; otherwise it uses `systemPrompt` as the fallback
prelude. Roleplay marker sections expand scene, lore, persona, character,
example-dialogue, and chat-history context, with transcript history included
only by an enabled `chat_history` marker. Depth sections are anchored to that
marker when present, or to the sectioned prompt message stream when it is
absent. If a sectioned preset materializes no messages after filtering,
Roleplay falls back to `systemPrompt` without automatically including
transcript history.
DeKoi appends a post-history contract that keeps the target companion primary
and prevents generation of the user's dialogue, intent, decisions, or
deliberate actions. With a selected preset, narration and other-character
behavior remain controlled by that preset; without one, Roleplay keeps its
single-character output contract.
Choice blocks contain stable IDs and variable names, optional questions,
stable-ID options with optional descriptions, reusable defaults, multi-select
and separator settings, `auto`/`buttons`/`listbox` display modes,
manual/alphabetical option ordering, optional ordering/timestamp metadata and
preset linkage, and independent option/default data. Runtimes must round-trip
those fields and all `variableOrder` entries; the catalog preserves
compatibility-only order slots while reordering choice-block slots. Choice
evaluation is deterministic and does not support `randomPick`; every normalized
choice is visible and independent.
Remote runtimes should expose native prompt preset records in storage. Packaged
`dekoi_preset` or compatible `marinara_preset` version 1 envelopes are
normalized only at DeKoi's bundle and standalone preset-file import boundaries;
they are not remote storage record shapes.

Default changes and non-default preset deletion are staged storage
transactions. The app writes only affected collections before publishing the
new state. The default and last preset cannot be deleted; deleting another
preset reassigns active thread references to the default and retains their
per-preset choice histories. Standalone preset imports receive fresh IDs and do
not change the default. Native bundle import preserves IDs, restores the bundled
starter if no usable preset remains, repairs the default, and reassigns dangling
active references to it.

`personas` records include `lorebookIds`, matching character lorebook bindings.
Runtimes should preserve those IDs when listing or replacing persona storage.

`lorebooks` records use `schemaVersion: 2`. Remote runtimes should preserve the
lorebook `activation` block and each entry's activation, placement, trigger,
filter, timing, recursion, inclusion, role, and match-source fields when
listing or replacing storage. New DeKoi records default activation to scan depth 2,
include names, whole-word matching, no recursive scan, unlimited configured
recursion steps, group scoring off, no absolute token cap, and a 25 percent
budget cap; new entries default to enabled `constant` notes placed
`after-character` with insertion order 100, probability 100, group weight 100,
and no insertion-order group-resolution flag. Primary and secondary key arrays
are trimmed to non-empty unique keys in first-seen order. Pre-v2 lorebook rows
were development-only and are rejected by DeKoi normalization rather than
migrated.

`lore-runtime-states` records use `schemaVersion: 1` and belong to a Messenger
or Roleplay branch through `ownerKind: "mode-branch"` and the branch `ownerId`. They store
mutable per-entry sticky and cooldown timers for lorebook timing effects. Each
entry state is keyed by `lorebookId` and `entryId`, records the entry's
`entryUpdatedAt`, and stores non-negative `activatedAtMessageIndex`,
`stickyRemaining`, and `cooldownRemaining` values. Deleting a thread or clearing
its transcript removes its matching lore runtime state; bundle import skips
orphaned lore runtime states and treats missing older bundle fields as empty.

`macro-variable-states` records use `schemaVersion: 1` and belong to global
state or a mode branch through `ownerKind` and `ownerId`. Global records use
`ownerKind: "global"` and `ownerId: "global"`; branch-scoped records use
`ownerKind: "mode-branch"` and the owning branch ID. The `variables` object stores
trimmed non-empty variable names with string values. Generation starts with
global variables, overlays active-branch variables, then overlays prompt-preset static
and choice variables for the active request. It persists committed mutations
only after generation succeeds. New variables created during a thread generation
are saved to the active branch scope; existing global-only variables remain global.
Deleting a thread or clearing its branch transcript removes matching branch-scoped
macro variable state, bundle import skips orphaned branch-scoped states, and
missing older bundle fields are treated as empty. Prompt-preset variables are
request inputs and are not persisted in this collection.
When Pond Care commits a legacy import, DeKoi remaps imported
legacy thread-variable scopes to converted mode branch IDs and merged imported global
variables with existing globals; imported same-name globals take precedence.
Legacy conversion is limited to recognized Messenger records; lorebook and
prompt-preset references are cleared, not imported. Development data may be
reset when storage shape changes.

When `generation_generate` includes resolved lorebooks, they use the same v2
shape. Current DeKoi prompt assembly resolves lorebook sources from the
chat/thread, active persona, selected companions, and app-wide global settings,
then scans each lorebook at most once before sending the request. Duplicate
lorebooks keep the first source bucket in deterministic order: chat, persona,
character, then global. Compatible runtimes should use `promptMessages` for
provider calls and do not need to re-run lorebook activation. Activation uses
macro-resolved lorebook summaries, lore entry bodies, and entry-opted additional
match sources through scratch macro contexts, so variable mutations do not
commit while scanning. It includes enabled constant entries with non-empty
source bodies unless blocked by timing delay or delayed until recursion, plus
selective entries whose primary keys match recent transcript text or entry-opted
additional match sources from selected companion `description`, `personality`,
`scenario`, and `characterNote` fields and the active persona `description`.
Additional match sources are off by default, and the lorebook `includeNames`
setting controls whether macro-resolved display names and nicknames are included
in their match blobs.
Transcript matching uses
`scanDepth` and `includeNames`; plaintext key matching uses
`caseSensitiveKeys` and `matchWholeWords`. Slash-delimited regex keys fall back
to plaintext with warnings when invalid or unsafe, and optional filter keys must
satisfy the entry's selective logic. Timing delay blocks direct and recursive
activation until the thread's non-empty transcript count reaches the entry's
`delay`; cooldown blocks reactivation while its timer remains, and sticky timers
activate entries before normal matching. When `recursiveScan` is enabled,
macro-resolved activated entry bodies can activate further entries unless
blocked by `nonRecursable`, `preventFurther`, or
`delayUntilRecursion`/`recursionLevel`; random and roll spans are stripped from
those recursion bodies so sampled text cannot unlock further entries.
`maxRecursionSteps` caps recursion passes, and `0` means unlimited until
DeKoi's 64-pass hard cap.
DeKoi resolves comma-separated inclusion groups after direct and recursive
activation. Active entries are sorted by descending `insertionOrder` before
group resolution, so overlapping groups are discovered in prompt-priority order.
When any candidate in a group has `prioritizeInclusion`, that flag switches the
whole group to highest-`insertionOrder` resolution; the flagged entry does not
automatically win. Otherwise, `useGroupScoring` keeps the candidate with the
highest unique matched primary-key count, and the default path uses weighted
random selection by `groupWeight`. Sticky activations bypass inclusion-group
suppression and per-entry probability; DeKoi then sorts activated entries by the
saved `loreInsertionStrategy`. `sorted-evenly` uses descending insertion order
across all source buckets, `character-first` ranks character-sourced lore first,
and `global-first` ranks global lore first; all strategies keep resolved
lorebook source order and entry order as stable tiebreakers. DeKoi places kept
entries before character context, after character context, or at transcript
depth, and applies lorebook budget caps before the runtime receives
`promptMessages`. Budget estimates use macro-resolved summaries and bodies at
roughly characters divided by 4. Budget trimming gives direct activations first
claim on the cap before recursive activations, then constant entries before
selective entries within each direct/recursive group; each priority group still
uses descending insertion order and stable lorebook/entry tiebreakers. Macro
budget previews are recomputed after earlier prompt-order variable commits, and
random lore text is sampled only when kept lore is emitted. Timers are started
or preserved only for entries that survive final formatting and budget trimming;
macro-empty or budget-dropped entries can clear sticky timers while preserving
remaining cooldown. Percent budgets apply only when the selected provider
connection has `maxContext`; otherwise DeKoi leaves the activated lore in place
instead of silently dropping it. Runtimes should preserve the provided
`promptMessages` roles and content, including at-depth system lore that DeKoi
has already converted to `user` for Anthropic or Google provider connections
and later Roleplay sectioned-preset system messages that would otherwise be
hoisted out of stream order.
Secondary-key logic is already applied before the runtime receives
`promptMessages`.
Character filters and triggers are still not applied by DeKoi prompt assembly.

`storage_list`:

```json
{
  "command": "storage_list",
  "args": {
    "entity": "mode-threads",
    "options": null
  }
}
```

Returns an array of records. An empty array is a successful empty collection;
collection adapters do not replace it with local seed records. The app-level
exception is prompt-preset recovery: any successful load with no usable prompt
presets restores the exact bundled starter in memory. Genuinely empty storage is
queued for persistence; dropped unreadable records keep automatic saving
blocked pending explicit repair. DeKoi treats a non-array response as a load
error. DeKoi preserves the error returned for every failed collection load and
shows all of them in Pond Care; the app-wide aggregate still uses the first
error. For array responses, DeKoi normalizes each raw item, counts rejected
items as dropped records, and surfaces that count through Pond Care; remote
runtimes do not send dropped-record counts separately.

`storage_replace`:

```json
{
  "command": "storage_replace",
  "args": {
    "entity": "mode-threads",
    "records": [
      {
        "id": "mode-thread-example",
        "schemaVersion": 1,
        "kind": "messenger",
        "title": "Messenger example",
        "activeBranchId": "branch-example",
        "branches": [
          {
            "id": "branch-example",
            "schemaVersion": 1,
            "threadId": "mode-thread-example",
            "kind": "messenger",
            "participantMode": "direct",
            "characterIds": [],
            "activePersonaId": null,
            "lorebookIds": [],
            "presetId": null,
            "presetChoiceSelectionsByPresetId": {},
            "providerConnectionId": null,
            "systemPromptMode": "default",
            "systemPrompt": "",
            "createdAt": "2026-06-24T07:20:00.000Z",
            "updatedAt": "2026-06-24T07:20:00.000Z"
          }
        ],
        "createdAt": "2026-06-24T07:20:00.000Z",
        "updatedAt": "2026-06-24T07:20:00.000Z"
      }
    ]
  }
}
```

Replaces the full collection for `entity` with `records`. DeKoi uses this as
the default save path so one collection save maps to one runtime write command.
Each record must be an object with a non-empty unique `id`; runtimes should
reject invalid or duplicate IDs instead of partially replacing a collection.
Durable runtimes should also reject replacement when the existing collection is
unreadable or known-corrupt rather than silently overwriting possible user data.
For `storage_replace`, DeKoi's TypeScript runtime adapters own native record
normalization before the call. Runtime implementations validate collection
structure and IDs; they do not duplicate every product-record validator.
After DeKoi loads a collection with dropped records, it will not call
`storage_replace` for that collection, or for the unified mode transcript safety
group when either projection has drops, until reload or import/restore clears
the dropped-record count.

Returns:

```json
{
  "ok": true,
  "count": 1,
  "metadata": {
    "entity": "mode-threads",
    "exists": true,
    "byteLength": 37,
    "updatedAtMs": 1782620000000,
    "contentHash": "fnv1a64:0123456789abcdef"
  }
}
```

DeKoi treats any response without `ok: true` and a numeric `count` as
incompatible. The `count` must match the number of records sent. `metadata` is
optional; when present, DeKoi uses it as the new stale-check baseline for that
collection only when the response succeeded and the metadata entity matches the
saved collection. A mismatched metadata entity is a storage contract error.

`storage_replace` is the primary DeKoi save path. Partial mutation commands are
strict targeted mutations: they must not upsert, silently replace records,
synthesize IDs, or create malformed durable product records.

Example RippleState list:

```json
{
  "command": "storage_list",
  "args": {
    "entity": "ripple-states",
    "options": null
  }
}
```

`storage_create`:

```json
{
  "command": "storage_create",
  "args": {
    "entity": "mode-threads",
    "value": {
      "id": "mode-thread-example",
      "schemaVersion": 1,
      "title": "Messenger example",
      "createdAt": "2026-06-24T07:20:00.000Z",
      "updatedAt": "2026-06-24T07:20:00.000Z"
    }
  }
}
```

Creates one record and returns it. `value` must be an object with a non-empty
`id`. Runtime implementations must reject an ID that already exists; create is
not replace. For non-settings collections, the created record must include
`schemaVersion >= 1`, `createdAt`, and `updatedAt`.

`storage_update`:

```json
{
  "command": "storage_update",
  "args": {
    "entity": "mode-threads",
    "id": "mode-thread-example",
    "patch": {
      "title": "Updated Messenger"
    }
  }
}
```

Updates one existing record and returns it. Missing IDs are errors; update is
not create. `patch.id`, when present, must match `args.id`. The persisted result
must still include required durable fields. Desktop and fixture runtimes stamp
`updatedAt` for non-settings collections.

`storage_delete`:

```json
{
  "command": "storage_delete",
  "args": {
    "entity": "mode-threads",
    "id": "mode-thread-example"
  }
}
```

Deletes one existing record. Missing IDs are errors; delete is not a no-op.
Returns:

```json
{
  "ok": true
}
```

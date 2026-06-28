# Remote Runtime Contract

DeKoi can talk to a local or remote runtime through a small HTTP contract. This
is intentionally provider-neutral: DeKoi sends native records and the runtime
decides how to generate, store, or transport them.

## Development Fixture

Start the local fixture:

```sh
npm run runtime:fixture
```

Default URL:

```text
http://127.0.0.1:7341
```

Use that URL in Pond Care > Deep Water > Remote Runtime URL. The fixture keeps
storage in memory, so records disappear when the fixture process stops.

Optional host and port:

```sh
npm run runtime:fixture -- --host 127.0.0.1 --port 7342
```

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

## Desktop Runtime

Inside the Tauri app, Pond Care > Deep Water can select:

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
collections only when no `.json.bak` or `.json.tmp` recovery sibling is present.
Malformed files and missing files with recovery artifacts return recoverable
storage errors instead of being overwritten by normal autosave. Desktop
collection writes use a synced temp file and preserve the previous readable file
as `<entity>.json.bak`; storage bundle writes use the temp/sync path without
creating a backup.

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

The browser adapter treats any non-2xx response as a runtime error and shows the
message in the active chat surface.

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

## `generation_generate`

The request may carry Messenger or Roleplay native fields for local context.
Runtimes should use the shared generation fields for provider calls:
`providerConnection`, `targetCharacterId`, `targetCharacterName`,
`promptMessages`, and `parameters`.

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
        "id": "messenger-thread-example",
        "schemaVersion": 1,
        "kind": "messenger",
        "mode": "direct",
        "title": "Example Messenger",
        "characterIds": ["character-koi"],
        "activePersonaId": "persona-xel",
        "lorebookIds": ["lorebook-main"],
        "presetId": null,
        "providerConnectionId": "connection-remote-runtime",
        "systemPromptMode": "default",
        "systemPrompt": "<default messenger system prompt>",
        "messages": [],
        "createdAt": "2026-06-24T07:10:00.000Z",
        "updatedAt": "2026-06-24T07:20:00.000Z"
      },
      "userMessage": {
        "id": "messenger-message-user",
        "threadId": "messenger-thread-example",
        "author": {
          "kind": "persona",
          "personaId": "persona-xel",
          "label": "Xel"
        },
        "body": "Can you hear me?",
        "origin": "manual",
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
        "createdAt": "2026-06-24T07:00:00.000Z",
        "updatedAt": "2026-06-24T07:00:00.000Z"
      },
      "lorebooks": [
        {
          "id": "lorebook-main",
          "schemaVersion": 1,
          "title": "Main Lorebook",
          "summary": "Example lore.",
          "entries": [
            {
              "id": "lore-entry-1",
              "title": "Contract",
              "body": "The runtime should return provider-neutral drafts.",
              "enabled": true,
              "createdAt": "2026-06-24T07:00:00.000Z",
              "updatedAt": "2026-06-24T07:00:00.000Z"
            }
          ],
          "createdAt": "2026-06-24T07:00:00.000Z",
          "updatedAt": "2026-06-24T07:00:00.000Z"
        }
      ],
      "providerConnectionId": "connection-remote-runtime",
      "providerConnection": {
        "id": "connection-remote-runtime",
        "schemaVersion": 1,
        "kind": "remote-runtime",
        "provider": "custom",
        "label": "Local OpenAI-compatible runtime",
        "baseUrl": "http://127.0.0.1:1234/v1",
        "model": "local-model",
        "summary": "",
        "status": "ready",
        "modelLabel": null,
        "keeperDefault": false,
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
      }
    }
  }
}
```

Response:

```json
{
  "schemaVersion": 1,
  "requestId": "generation-request-example",
  "providerKind": "remote-runtime",
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

Provider connection records in generation requests do not include saved API key
material. Desktop generation resolves saved keys through the desktop provider
secret store by connection id. Remote runtimes that need saved secrets should
use a separate secret capability rather than storage records or generation
payload fields.

## Storage Commands

Supported storage entities:

- `app-settings`
- `characters`
- `roleplay-threads`
- `roleplay-entries`
- `lorebooks`
- `messenger-threads`
- `messenger-messages`
- `personas`
- `provider-connections`
- `ripple-states`

The browser app does not persist these entities in browser storage. If the app
is not running in Tauri, configure a Remote Runtime URL before expecting durable
storage.

Messenger and Roleplay transcript storage is split. `messenger-threads` records
omit `messages`, and `roleplay-threads` records omit `entries`; transcript items
live in `messenger-messages` and `roleplay-entries` with `schemaVersion: 1` and
`threadId`. DeKoi assembles thread records with their transcript items before
rendering or generating. Legacy embedded `messages` or `entries` may still be
accepted on load or bundle import, but normal writes use the split collections.

`storage_list`:

```json
{
  "command": "storage_list",
  "args": {
    "entity": "messenger-threads",
    "options": null
  }
}
```

Returns an array of records.

`storage_replace`:

```json
{
  "command": "storage_replace",
  "args": {
    "entity": "messenger-threads",
    "records": [
      {
        "id": "messenger-thread-example"
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

Returns:

```json
{
  "ok": true,
  "count": 1
}
```

DeKoi treats any response without `ok: true` and a numeric `count` as
incompatible. The `count` must match the number of records sent.

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
    "entity": "messenger-threads",
    "value": {
      "id": "messenger-thread-example"
    }
  }
}
```

Returns the created record.

`storage_update`:

```json
{
  "command": "storage_update",
  "args": {
    "entity": "messenger-threads",
    "id": "messenger-thread-example",
    "patch": {
      "title": "Updated Messenger"
    }
  }
}
```

Returns the updated record.

`storage_delete`:

```json
{
  "command": "storage_delete",
  "args": {
    "entity": "messenger-threads",
    "id": "messenger-thread-example"
  }
}
```

Returns:

```json
{
  "ok": true
}
```

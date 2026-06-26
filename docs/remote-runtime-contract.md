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

`runtime` may also be `marinara-server` while DeKoi is still compatible with
that runtime marker. The Tauri desktop host uses `de-koi-desktop` internally
when Pond Care selects the desktop runtime.

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

It also provides fixture-style Messenger generation. It is a host contract
bridge, not a real provider transport yet.

## Invoke Envelope

All runtime commands use:

```http
POST /api/invoke
Content-Type: application/json
X-Marinara-CSRF: 1
```

Request envelope:

```json
{
  "command": "messenger_generate",
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
message in Messenger.

## Commands

The explicit DeKoi allowlist currently contains:

- `messenger_generate`
- `storage_list`
- `storage_create`
- `storage_update`
- `storage_delete`

Generation and storage commands must remain separately named. Do not overload
`messenger_generate` to persist messages or overload storage commands to run
generation.

The TypeScript command registry is `src/shared/api/runtime-commands.ts`. Run this
after changing the command list:

```sh
pnpm check:runtime-contracts
```

## `messenger_generate`

Request:

```json
{
  "command": "messenger_generate",
  "args": {
    "request": {
      "schemaVersion": 1,
      "id": "messenger-generation-request-example",
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
      "providerConnectionId": "connection-remote-runtime"
    }
  }
}
```

Response:

```json
{
  "schemaVersion": 1,
  "requestId": "messenger-generation-request-example",
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

## Storage Commands

Supported storage entities:

- `app-settings`
- `characters`
- `classic-threads`
- `lorebooks`
- `messenger-threads`
- `personas`
- `provider-connections`
- `ripple-states`

The browser app does not persist these entities in browser storage. If the app
is not running in Tauri, configure a Remote Runtime URL before expecting durable
storage.

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

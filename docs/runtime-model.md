# Runtime Model

DeKoi uses a few similar-sounding terms that should stay separate in code and
docs.

## Surface Mode

A surface mode is a user-facing product area:

- Messenger
- Roleplay
- future surfaces such as Visual Novel or Game-style play, if DeKoi owns them

Surface modes own records, UI, prompt assembly, and behavior. Do not use runtime
or provider terms to mean Messenger or Roleplay.

## Host Runtime

A host runtime is where privileged app work executes:

- the Tauri desktop runtime
- a compatible remote HTTP runtime
- the browser/dev fallback when no desktop host is available

Host runtimes own storage, provider secret access, desktop commands, and remote
runtime command transport. The remote HTTP runtime contract lives in
[remote-runtime-contract.md](./remote-runtime-contract.md).

## Provider Connection

A provider connection is the user's saved model or service configuration:

- OpenAI, Anthropic, OpenRouter, xAI, or another hosted provider
- a local OpenAI-compatible server
- a custom endpoint

Native provider connection records use `kind: "provider"`. The old
`"remote-runtime"` provider-connection kind is legacy source vocabulary and
should only appear in storage-boundary migration code or historical examples.

Native storage and DeKoi storage bundles narrowly migrate valid old
`kind: "remote-runtime"` provider connection rows to `kind: "provider"` while
preserving their IDs, so existing threads keep their selected connection. The
old row must still have a recognized provider and native provider fields.
Removed provider lanes such as `mock`, `local`, malformed `remote-runtime`, or
missing `kind` still reject on the native load path. Wider alias and shape
cleanup belongs in the one-way legacy import path.

## Generation Transport

Generation transport is how DeKoi sends one assembled generation request.
Current DeKoi provider-backed generation uses:

- a desktop runtime command when the Tauri host is available
- a direct browser provider call when no desktop host is available and the
  selected provider can run without desktop-only secrets

This is not a user-facing mode. Messenger and Roleplay should not pass a
generation runtime mode unless a real second generation transport exists and both
surfaces have explicit behavior for it.

Generation responses use a `source` field to identify who produced the
normalized response. `remote-runtime` means a compatible HTTP runtime produced
the response; `provider-transport` means DeKoi's built-in desktop or browser
provider transport produced it.

## Naming Rules

- Use `surface` or the concrete surface name for Messenger and Roleplay.
- Use `host runtime` for desktop, remote HTTP, or browser/dev execution.
- Use `provider connection` for saved model/service configuration.
- Use `generation transport` for the request-sending path.
- Use `remote runtime` only for the compatible HTTP runtime contract or runtime
  target selection.

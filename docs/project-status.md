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
- One-way legacy thread import into native Messenger records.

## Experimental Or Incomplete

- Provider transport is still narrow and experimental; required-key providers use
  desktop provider-key storage through the runtime boundary.
- Runtime generation routing is not fully symmetric yet: desktop uses the
  desktop runtime provider path, while browser mode has a direct provider
  fallback and remote-runtime command paths for storage/check/model commands.
- Developer docs under docs/developer are migrated material that still needs validation against this implementation.
- Roleplay is present as a native surface, but the first product loop is still centered on Messenger and shared catalog records.
- Ripples have engine records, actions, persistence, and bundle support, but no
  dedicated routed editor surface yet.
- Media and preset rails are placeholder-only.
- Legacy thread import is an explicit one-way adapter into native Messenger
  records; automatic browser-storage migration remains out of scope.
- Storage is collection-backed first; a database may replace the implementation later only behind the same record contracts.

## Intentionally Out Of Scope For Now

- Feature parity with the old dashed project line.
- Copying old code, assets, docs, prompts, schemas, UI text, or layouts.
- Treating legacy record names as native DeKoi concepts.
- Game/adventure-style play as a first product slice.
- Browser storage as the durable app-record store.
- Provider secrets inside exported DeKoi bundles.

## Near-Term Documentation Needs

- Validate migrated developer docs against current source.
- Add screenshots or short walkthroughs once the first user loop is stable enough to document visually.
- Keep README status current as provider transport and legacy import become real features.

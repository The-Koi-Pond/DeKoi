# Project Status

DeKoi is an early clean-room seed for a private-first story and character engine. The current repository proves the first native app shape and runtime boundaries; it is not a full replacement for older fork-derived work.

## Works Now

- React and TypeScript app shell built with Vite.
- Native product records for Messenger, Classic, companions, personas, lorebooks, provider connections, and Ripples.
- Collection-backed storage entity registry and Rust allowlist checks.
- DeKoi-native bundle import and export paths through the desktop host.
- Provider-key secret commands through the desktop host.
- Remote runtime fixture and HTTP invoke contract for storage and Messenger generation.
- Desktop runtime bridge for host-backed fixture generation and durable app-data storage.

## Experimental Or Incomplete

- Provider transport is still behind fixture-style generation and runtime boundaries.
- Developer docs under docs/developer are migrated material that still needs validation against this implementation.
- Classic is present as a native surface, but the first product loop is still centered on Messenger and shared catalog records.
- Legacy import is intentionally explicit future work, not automatic browser-storage migration.
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

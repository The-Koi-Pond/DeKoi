# Storage Roadmap

Status: target roadmap. Current enforceable storage guardrails live in
[`docs/storage-model.md`](./storage-model.md).

This document records the storage direction DeKoi should converge on. It is not
a current implementation claim and is not validated by
`pnpm check:storage-contracts` unless the canonical storage model is updated.

## North Star

DeKoi storage should stay collection-contract first: DeKoi-native records in
owned collections, safe host writes behind narrow runtime contracts, provider
secrets and future assets kept separate, and import/export paths explicit enough
that a user can understand what will happen before data changes.

## Current Anchors

- `docs/storage-model.md` is the canonical current contract.
- `src/runtime/storage/storage-entities.ts` and the Rust storage allowlist define
  collection entity names.
- `src/runtime/storage/app-storage-snapshot.ts` assembles and replaces app
  storage snapshots.
- `src/app/use-app-storage-sync.ts` owns current React lifecycle storage sync:
  startup load, dirty collection queueing, stale checks, reload blocking, and
  import coordination.
- `src/features/runtime/storage` owns user-facing storage workflow wrappers.
- `src-tauri` owns desktop file IO, bundle dialogs, repair, and provider
  secrets behind shared API wrappers.

## Target Shape

- Product record types and pure behavior stay in `src/engine`.
- Runtime storage normalizes JSON into engine records, adapts repositories,
  assembles snapshots, and handles bundle import/export.
- Feature UI renders state and gathers intent; it does not define durable
  schemas or bypass shared API wrappers.
- Desktop and remote storage both use explicit collection names. Remote runtimes
  may use files, a database, or another backing store internally.
- Provider secrets are not collection records and are never exported in DeKoi
  bundles.
- Legacy import remains a one-way adapter into DeKoi-native records.

## Near-Term Roadmap

1. Expose an explicit app-storage flush barrier that settles pending saves before
   backup, export, import, reload, or shutdown workflows.
2. Add bundle fingerprinting between preview and commit so stale previews cannot
   commit different normalized data.
3. Add an explicit in-session restore action backed by the pre-import records
   after a partial import failure.

## Future Gates

These are intentionally not current contracts:

- Storage manifest: add only for diagnostics, migrations, support metadata, or
  app-managed backup history.
- Asset storage: add only when durable file bytes become product data. Collection
  rows should reference asset IDs or safe relative paths; bytes should live under
  a runtime-controlled asset root.
- Database adapter: add only when collection JSON cannot satisfy a concrete
  product need such as pagination, indexed search, full-text search,
  transactional multi-collection writes, or multi-process concurrency. It goes
  behind `src/runtime/storage/storage-repository-factory.ts`.
- Desktop storage split: move desktop storage into a dedicated capability
  module or crate once record repair, cleanup, or profile import makes
  `src-tauri/src/storage.rs` too broad.

## Guardrails

- Keep collection entity names unchanged unless the canonical storage model and
  contract check change deliberately.
- Keep transcript rows split from thread metadata.
- Keep provider keys out of collection JSON, bundles, and restore payloads.
- Do not silently recover corrupt collection files by treating them as empty.
- Do not leak SQL table names, host file paths, or old compatibility names into
  DeKoi product concepts.

<!-- Target branch: `main`. Change the base to `main` unless a maintainer explicitly asked for another base. -->
<!-- Keep checkboxes unchecked until a human has actually verified them. -->

## Linked issue

<!-- Every user-facing PR should reference a feature request or issue report when practical. -->

Closes #

## Why this change

<!-- What user problem, bug, architecture goal, or maintenance need does this solve? -->

-

## What changed

<!-- List the key changes in this PR. -->

-

## Clean-room boundary

<!-- DeKoi may reuse Xel-authored workflow guidance. Product code still follows CLEAN_ROOM.md. -->

- [ ] Requirement and implementation are written in DeKoi-owned terms.
- [ ] No old source code, assets, generated bindings, storage schemas, UI text, or component layouts were copied into product code.
- [ ] Legacy compatibility, if touched, remains one-way import behavior into native DeKoi records.

## Architecture impact

Primary owner:

<!-- Examples: app shell, Messenger, Roleplay, catalog, provider connections, runtime storage, shared API, React-free engine, Rust desktop capability, docs/tooling. -->

-

Impact areas reviewed:

-

Boundary notes:

<!-- Note engine/feature/runtime/shared/Rust/remote-runtime boundaries. Say "none" only if you checked. -->

-

Pressure points touched:

<!-- Mention command registration, runtime command allowlists, storage entities, import/export modules, provider secrets, file dialogs, or shared API wrappers if touched. -->

-

## Validation

<!-- Check only what you personally ran or manually verified. Treat unchecked items as explicit TODOs. -->
<!--
Proof is session evidence, not permission to add durable test artifacts by reflex.
Temporary local tests or harnesses are fine when they remain uncommitted.
If this PR adds a committed test artifact, explain the durable test rationale in
the notes below: the regression or risky invariant, why existing proof is
insufficient, and why this test is narrow.
-->

- [ ] Matching validation command passes locally, such as `pnpm build`, `pnpm lint`, `pnpm check:frontend-boundaries`, `pnpm check:storage-contracts`, `pnpm check:runtime-contracts`, `pnpm check:desktop-contracts`, `pnpm check:bunny-review`, or `pnpm check:rust`.
- [ ] Full `pnpm check` passes before PR push/handoff.
- [ ] Human/manual validation completed where behavior, UI, storage, import/export, provider, or desktop host behavior changed.

### Manual verification notes

<!-- Describe exact commands and manual steps, including TypeScript/build/lint/storage/runtime/Rust/browser/desktop checks when they apply. -->

-

## User-facing discovery

Check exactly one:

- [ ] Updated relevant docs or in-app affordances because this PR adds or materially changes a user-discoverable feature, workflow, setting, mode, panel, import path, media capability, or advanced tool.
- [ ] N/A because this PR is only a bugfix, architecture cleanup, test, docs, internal wiring, visual polish, copy edit, or compatibility fix and does not add a new thing users need to find.

Reason:

-

## Docs and release impact

- [ ] No docs changes needed
- [ ] Updated `README.md`
- [ ] Updated `CONTRIBUTING.md`
- [ ] Updated `CLEAN_ROOM.md`
- [ ] Updated `docs/`
- [ ] Updated repo workflow guidance or `.github/`
- [ ] Confirmed this PR keeps DeKoi separate from the old dashed project line

## UI evidence

<!-- Add before/after screenshots or recordings for visible UI changes. -->

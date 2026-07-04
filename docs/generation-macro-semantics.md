# Generation Macro Semantics

Status: Slice 1 resolver contract is implemented. Full generation wiring is a
Slice 3 follow-up; current Messenger and Roleplay system prompts still use the
temporary `replaceGenerationPromptMacros` helper, which resolves `{{char}}`,
`{{user}}`, and their compatibility aliases.

## Boundary

Macros are DeKoi-owned prompt assembly behavior. The implementation is
clean-room, pure TypeScript under `src/engine/generation-core/macros`, and must
not import React, feature code, runtime adapters, Tauri APIs, browser APIs, or
storage.

The public entry point is:

```ts
resolveMacros(template: string, context: MacroContext, options?: ResolveMacroOptions): string
```

The resolver is deterministic for a given template and context. Slice 1 does
not read storage, mutate context, call providers, or use randomness.

## Syntax

- A macro span starts with `{{` and ends with the matching balanced `}}`.
- Nested macro spans resolve innermost first.
- Malformed spans without a matching closing `}}` are left unchanged.
- Spans deeper than the 64-level parser depth guard are treated as malformed
  and left unchanged.
- Macro names are matched after trimming whitespace inside the braces.
- Unknown macros are left as macro spans. If an unknown outer macro contains a
  known nested macro, the nested value resolves first.
- Empty macros are unknown and remain unchanged.
- `{{// ...}}` is a comment macro and resolves to an empty string.
- Slice 1 has no escape syntax for a well-formed macro span. If the body matches
  no active macro, the span remains visible; known nested macros inside it still
  resolve first.
- Replacement values can themselves contain macros. Resolution repeats up to
  the recursion guard.
- The recursion guard is 16 passes. On overflow, the resolver returns the
  original input for that call, discarding partial progress made in earlier
  passes, then applies the same final trim rule as any other result.
- Final output is trimmed by default. Pass `{ trimResult: false }` to preserve
  leading and trailing whitespace.
- DeKoi prefers canonical identity macros. `{{charName}}` and `{{userName}}`
  are supported compatibility aliases for pasted or older local prompts, but
  new DeKoi-authored prompts should use `{{char}}` and `{{user}}`.

## Slice 1 Macros

Identity macros:

| Macro            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `{{user}}`       | `context.user`                                                     |
| `{{userName}}`   | alias for `{{user}}`                                               |
| `{{char}}`       | `context.char`                                                     |
| `{{charName}}`   | alias for `{{char}}`                                               |
| `{{characters}}` | `context.characters.join(", ")`                                    |
| `{{persona}}`    | active persona display name when present, otherwise `context.user` |

Character field macros read `context.characterFields` and resolve missing
values to an empty string:

| Macro                         | Field                     |
| ----------------------------- | ------------------------- |
| `{{displayName}}`             | `displayName`             |
| `{{nickname}}`                | `nickname`                |
| `{{description}}`             | `description`             |
| `{{personality}}`             | `personality`             |
| `{{scenario}}`                | `scenario`                |
| `{{firstMessage}}`            | `firstMessage`            |
| `{{exampleMessages}}`         | `exampleMessages`         |
| `{{systemPrompt}}`            | `systemPrompt`            |
| `{{postHistoryInstructions}}` | `postHistoryInstructions` |
| `{{creator}}`                 | `creator`                 |
| `{{characterVersion}}`        | `characterVersion`        |
| `{{creatorNotes}}`            | `creatorNotes`            |
| `{{characterNote}}`           | `characterNote`           |

Context macros resolve missing values to an empty string:

| Macro                    | Value                        |
| ------------------------ | ---------------------------- |
| `{{input}}`              | `context.lastInput`          |
| `{{model}}`              | `context.model`              |
| `{{chatId}}`             | `context.chatId`             |
| `{{lastGenerationType}}` | `context.lastGenerationType` |
| `{{idle_duration}}`      | `context.idleDuration`       |

## Reserved Later Semantics

These macro families are intentionally not active in Slice 1. Until their
slices land, matching spans remain unchanged unless they contain nested Slice 1
macros:

- time and formatting macros
- random and dice macros
- control-flow blocks
- deferred character macros for group scenarios
- variable macros and variable snapshot transactions
- persistent dynamic variable storage

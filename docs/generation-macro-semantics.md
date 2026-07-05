# Generation Macro Semantics

Status: Slice 4 control-flow, random, and dice macros are implemented.
Generation prompt assembly now uses the Slice 1/2/4 resolver for system prompts,
Roleplay scene setup, character and persona context fields, post-history
instructions, lorebook summaries, activated lore entry bodies, at-depth lore
messages, and example dialogue.

## Boundary

Macros are DeKoi-owned prompt assembly behavior. The implementation is
clean-room, pure TypeScript under `src/engine/generation-core/macros`, and must
not import React, feature code, runtime adapters, Tauri APIs, browser APIs, or
storage.
Slice 2 time macros use ECMAScript `Date` and `Intl.DateTimeFormat` built-ins;
their display strings can vary with the host runtime's ICU and time-zone data.

The public entry point is:

```ts
resolveMacros(template: string, context: MacroContext, options?: ResolveMacroOptions): string
```

The resolver does not read storage, mutate context, call providers, or touch
runtime adapters. It is deterministic for a given template and context when
callers pass `context.now` and `options.random`; if they omit `context.now`, the
resolver snapshots the current wall-clock time once per `resolveMacros` call.
If callers omit `options.random`, random and dice macros use `Math.random`.
Injected random values are clamped into `[0, 1)`: non-finite values and values
at or below `0` become `0`, while values at or above `1` become a value just
below `1`.

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
- A macro whose body starts with `//` after leading whitespace is a comment
  macro and resolves to an empty string before nested content inside the comment
  can evaluate.
- The resolver has no escape syntax for a well-formed macro span. If the body
  matches no active macro, the span remains visible; known nested macros inside
  it still resolve first.
- Replacement values can themselves contain macros. Resolution repeats up to
  the recursion guard.
- The recursion guard is 16 passes. On overflow, the resolver returns the
  original input for that call, discarding partial progress made in earlier
  passes, then applies the same final trim rule as any other result. Format
  post-processing is skipped on this overflow fallback, so format markers in
  the original input remain visible.
- Final output is trimmed by default. Pass `{ trimResult: false }` to preserve
  leading and trailing whitespace.
- DeKoi prefers canonical identity macros. `{{charName}}` and `{{userName}}`
  are supported compatibility aliases for pasted or older local prompts, but
  new DeKoi-authored prompts should use `{{char}}` and `{{user}}`.
- `{{uppercase}}...{{/uppercase}}` and `{{lowercase}}...{{/lowercase}}`
  transform the resolved block body. Nested case blocks are supported. Malformed
  case blocks are left visible. Case block post-processing has a 64-level depth
  guard; over-depth case blocks are left visible. Case transforms skip
  parser-malformed macro tails, and complete case blocks inside unresolved
  unknown macro spans transform only when the open and close markers are inside
  the same span. Case transforms are terminal post-processing; macro-looking
  text produced by changing case is not resolved again.
- `{{trimStart}}` removes whitespace immediately after its marker,
  `{{trimEnd}}` removes whitespace immediately before its marker, and
  `{{trim}}` removes whitespace on both sides. Trim markers are removed before
  case transforms. Trim macros use reserved internal sentinel strings during
  resolution; prompt content should not intentionally include `NUL`-delimited
  `DEKOI_MACRO_TRIM` sentinel text.

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

Generation callers derive `context.lastInput` at the mode boundary. Messenger
uses the current user message being generated from. Roleplay uses the latest
nonblank thread entry body, regardless of whether that entry is persona,
character, scene, or narration. Generation macro context trims this value before
resolution.

Generation macro context also trims persona and companion display names before
assigning `context.user`, `context.char`, and `context.characters`; empty names
fall back to mode-owned labels such as `the user`, `the selected companion`, or
`the selected character`. Character field macros normally read the target
companion. When prompt assembly renders each companion's context or example
dialogue, that companion temporarily becomes `context.char` and
`context.characterFields` for that field resolution.

For lore activation, DeKoi resolves current built-in macros in lorebook
summaries, lore entry bodies, and opted-in companion/persona match-source fields
before activation, recursive scanning, timer updates, and budget estimates.
Macro-empty lore bodies do not activate or start timers. Unknown macros stay
visible in the resolved prompt text, while comment macros still resolve empty.

## Slice 2 Macros

Time macros use `context.now` when provided, otherwise one current wall-clock
snapshot shared by every time macro in the resolver call. `context.now` accepts
a `Date`, string, or number handled by the ECMAScript `Date` constructor.
Display macros format with `Intl.DateTimeFormat` using the DeKoi default locale
`en-US`. They use normalized `context.timeZone` when valid and `UTC` when no
time zone is passed. Invalid time zones leave `{{time}}`, `{{date}}`,
`{{weekday}}`, and `{{timezone}}` visible, while `{{isotime}}` does not depend
on the time zone. Invalid `context.now` values leave `{{time}}`, `{{date}}`,
`{{weekday}}`, and `{{isotime}}` visible, while `{{timezone}}` can still resolve.

| Macro          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| `{{time}}`     | hour and minute in normalized `context.timeZone`, or `UTC`  |
| `{{date}}`     | long date in normalized `context.timeZone`, or `UTC`        |
| `{{weekday}}`  | weekday name in normalized `context.timeZone`, or `UTC`     |
| `{{isotime}}`  | resolved time as `Date.prototype.toISOString()`             |
| `{{timezone}}` | normalized `context.timeZone`, or `UTC` when none is passed |

Formatting macros:

| Macro                            | Value                              |
| -------------------------------- | ---------------------------------- |
| `{{newline}}`                    | newline character                  |
| `{{trim}}`                       | trims whitespace on both sides     |
| `{{trimStart}}`                  | trims following whitespace         |
| `{{trimEnd}}`                    | trims preceding whitespace         |
| `{{uppercase}}...{{/uppercase}}` | uppercases the resolved block body |
| `{{lowercase}}...{{/lowercase}}` | lowercases the resolved block body |

## Slice 4 Macros

Control macros:

| Macro        | Value        |
| ------------ | ------------ |
| `{{noop}}`   | empty string |
| `{{banned}}` | empty string |

Conditional blocks use:

```text
{{#if condition}}truthy content{{else}}falsy content{{/if}}
```

`{{else}}` is optional. The first same-depth `{{else}}` separates the branches;
additional `{{else}}` markers in selected content are treated as unresolved
macros. Malformed, unclosed, over-depth, or unresolved condition blocks remain
visible and keep their contents inert. Only the selected branch is evaluated, so
random macros and later side-effect macros in the unselected branch do not run.
Condition block nesting has a 64-level guard.

Condition expressions are case-sensitive string checks:

- No operator: the resolved operand is true when its trimmed value is non-empty.
- `==` and `is`: left and right operands are equal.
- `!=`: left and right operands are not equal.
- `contains` and `includes`: the left operand contains the right operand.

Operands can be unquoted macro names such as `char`, `user`, `model`, or
`characters`; quoted strings with straight or curly single/double quotes; nested
macro spans such as `{{char}}`; or bare literal text. Quoted operands are
literal except that nested macro spans inside the quoted text still resolve.
Unquoted operands first try active built-ins, then fall back to their literal
text when no active built-in matches.

Random macros:

| Macro                    | Value                                              |
| ------------------------ | -------------------------------------------------- |
| `{{random}}`             | random decimal in `[0, 1)`                         |
| `{{random:A:B}}`         | one option selected from exactly two options       |
| `{{random::A::B}}`       | one option selected from double-colon options      |
| `{{random::A@2::B@0.5}}` | weighted option selection using relative weights   |
| `{{roll:XdY}}`           | total from rolling `X` dice with `Y` sides per die |

Random options trim surrounding whitespace. The single-colon form is exactly
two options split at the first option separator; without that separator it
remains visible. Use the double-colon form for variadic options or values that
contain literal colons. Nested macros inside random options resolve before
option selection. A trailing numeric `@weight` marks that option's relative
weight; decimals are allowed, `0` excludes the option, and non-numeric `@` text
such as email addresses remains part of the option. If every option is excluded,
the macro resolves to an empty string.

Dice rolls require positive integer `X` and `Y` values; the `d` separator is
case-insensitive. To keep prompt resolution bounded, rolls over 1000 dice or
over 1000000 sides are invalid and remain visible.

## Reserved Later Semantics

These macro families are intentionally not active yet. Until their slices land,
matching spans remain unchanged unless they contain nested active macros:

- deferred character macros for group scenarios
- variable macros and variable snapshot transactions
- persistent dynamic variable storage

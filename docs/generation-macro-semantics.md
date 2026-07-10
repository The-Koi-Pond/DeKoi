# Generation Macro Semantics

Status: Slice 7 dynamic variable persistence, Slice 9a active-macro editor
metadata, and the Slice 9b catalog live-preview pass are implemented.
Generation prompt assembly now uses the Slice 1/2/4/6 resolver and Slice 7
persistence flow for system prompts, Roleplay scene setup, character and persona
context fields, selected prompt preset system prompts, selected Messenger
preset prompt sources, selected Roleplay prompt preset sections and markers,
prompt-preset static and choice variables, post-history instructions, lorebook
summaries, activated lore entry bodies, at-depth lore messages, and example
dialogue.

## Boundary

Macros are DeKoi-owned prompt assembly behavior. The implementation is
clean-room, pure TypeScript under `src/engine/generation-core/macros`, and must
not import React, feature code, runtime adapters, Tauri APIs, browser APIs, or
storage.
Slice 2 time macros use ECMAScript `Date` and `Intl.DateTimeFormat` built-ins;
their display strings can vary with the host runtime's ICU and time-zone data.

The primary resolver entry points are:

```ts
resolveMacros(template: string, context: MacroContext, options?: ResolveMacroOptions): string
createScratchMacroContext(context: MacroContext): MacroContext
resolveMacrosWithScratchContext(
  template: string,
  context: MacroContext,
  options?: ResolveMacroOptions,
): string
```

The engine also exports `SUPPORTED_MACROS` and `SUPPORTED_MACRO_CATEGORIES` for
editor UI consumption. `SUPPORTED_MACROS` is projected from the same
`macro-definitions.ts` source that resolver modules use for literal names,
prefixes, and supported pattern families. This list is active-only: future or
deferred macro ideas must not be shown as supported until the resolver
implements them.

Catalog multiline text editors expose a Macros browser for the macro-resolved
text areas wired in this slice: Companion and Persona descriptive fields, system
prompts, post-history instructions, notes, Companion example dialogue, Prompt
Preset system prompts, Prompt Preset Messenger Prompt Sources, and Lorebook
entry bodies. Companion first-message,
alternate-greeting, and group-only greeting fields remain plain text today. The
browser searches supported syntax, category labels, and descriptions, then
inserts the selected macro text at the current textarea selection. Companion and
Persona editors also show live previews when a field is focused or its Macros
browser is open, the field contains macro syntax, and the catalog draft
supplies a local macro context. Companion previews resolve the draft companion
identity and character fields. Persona previews resolve the draft persona
identity and generic `{{char}}` selected-companion fallback, but do not
fabricate target-companion field values; blank persona drafts preserve
`{{persona}}` literally until a display name exists. Prompt Preset system
prompts, Messenger Prompt Sources, and Lorebook entry bodies still expose
insertion only in catalog because they need an active generation context to
preview accurately.

The resolver does not read storage, call providers, or touch runtime adapters.
Variable macros can mutate `context.variables` and optionally append to
`context.variableMutations`; callers that need non-mutating previews should use
the scratch resolver helpers so preview work clones variables and discards any
mutation log. Resolution is deterministic for a given template and context when
callers pass `context.now` and `options.random`; if they omit `context.now`, the
resolver snapshots the current wall-clock time once per `resolveMacros` call. If
callers omit `options.random`, random and dice macros use `Math.random`.
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
- Unknown macros are left as macro spans. Nested macros inside an unknown outer
  macro stay inert, except comment spans are still stripped and terminal case
  post-processing can transform complete case blocks inside that unknown span.
- Empty macros are unknown and remain unchanged.
- A macro whose body starts with `//` after leading whitespace is a comment
  macro and resolves to an empty string before nested content inside the comment
  can evaluate.
- The resolver has no escape syntax for a well-formed macro span. If the body
  matches no active macro, the span remains visible; most nested macros inside
  that unknown span remain inert as described above.
- Replacement values can themselves contain macros. Resolution repeats up to
  the recursion guard.
- The recursion guard is 16 passes. On overflow, the resolver returns the
  original input for that call, discarding partial progress made in earlier
  passes, then applies the same final trim rule as any other result. Format
  post-processing is skipped on this overflow fallback, so format markers in
  the original input remain visible. Variable mutations made during an
  overflowing or otherwise exhausted replacement are rolled back.
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
Activation uses scratch macro contexts, so variable mutations do not commit
while scanning. Random options use the first valid option for activation
previews, and random or roll spans are removed from recursive scan bodies so
hidden random results cannot unlock further lore. Lore with a non-empty source
body can remain an activation candidate even when its activation preview is
empty; if final formatting resolves the kept body empty, it is omitted and does
not start timers. Unknown macros stay visible in the resolved prompt text, while
comment macros still resolve empty.

## Slice 2 Macros

Time macros use `context.now` when provided, otherwise one current wall-clock
snapshot shared by every time macro in the resolver call. `context.now` accepts
a `Date`, string, or number handled by the ECMAScript `Date` constructor.
Display macros format with `Intl.DateTimeFormat` using the DeKoi default locale
`en-US`. They use normalized `context.timeZone` when valid and `UTC` when no
time zone is passed to the resolver. Messenger and Roleplay runtime generation
auto-detect the current local time zone when their `timeZone` input is omitted
or `null`, then pass that primitive string into engine prompt assembly. Explicit
string inputs are preserved for override callers. If local time-zone detection
is unavailable, the runtime passes `null` and the engine resolver uses its UTC
fallback. Invalid time zones leave `{{time}}`, `{{date}}`, `{{weekday}}`, and
`{{timezone}}` visible, while `{{isotime}}` does not depend on the time zone.
Invalid `context.now` values leave `{{time}}`, `{{date}}`, `{{weekday}}`, and
`{{isotime}}` visible, while `{{timezone}}` can still resolve.

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
Bare operands also read `context.variables` before becoming literals. Unknown
bare operands such as `Dragon`, `questComplete`, or `quest-complete` remain
literal truthy text; use explicit variable macros such as
`getvar::questComplete` when a missing variable should resolve as empty/false.

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
contain literal colons. Option separators inside balanced `#if`, `uppercase`,
or `lowercase` blocks are treated as content, not separators. Nested macros
inside the selected random option resolve before output. Unselected options are
previewed without committing variable mutations, so only the selected option can
change variables. A trailing numeric `@weight` marks that option's relative
weight; decimals are allowed, `0` excludes the option, and non-numeric `@` text
such as email addresses remains part of the option. If every option is excluded,
the macro resolves to an empty string.

Dice rolls require positive integer `X` and `Y` values; the `d` separator is
case-insensitive. To keep prompt resolution bounded, rolls over 1000 dice or
over 1000000 sides are invalid and remain visible.

## Slice 6 Macros

Variable macros read and mutate `context.variables`, which is an in-memory
string map owned by the caller for the current prompt assembly.

| Macro                     | Value                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| `{{getvar::name}}`        | `context.variables.name`, or empty string when missing           |
| `{{name}}`                | same as `getvar` when `name` exists and no earlier built-in wins |
| `{{setvar::name::value}}` | sets `name` to `value` and renders empty string                  |
| `{{addvar::name::delta}}` | adds numeric `delta` to `name` and renders empty string          |
| `{{incvar::name}}`        | adds `1` to `name` and renders empty string                      |
| `{{decvar::name}}`        | adds `-1` to `name` and renders empty string                     |

Variable names are trimmed and may contain punctuation; empty names are invalid
and leave the macro visible. `setvar` values preserve everything after the
second `::`. Arithmetic uses JavaScript `Number`; missing, non-finite, or
non-numeric current values and deltas are treated as `0`. Explicit built-ins win
over catch-all variable names, so a variable named `newline` does not shadow
`{{newline}}`; use `{{getvar::newline}}` to read it.

Variable mutations run left-to-right across the resolved prompt text and across
recursive replacement values. Mutations in comments, unselected condition
branches, unselected random options, unknown macro bodies, unresolved condition
blocks, and overflowing recursive replacements are rolled back or never run.
When `context.variableMutations` is present, committed `set` and `add`
mutations are appended for callers that need to replay a preview later.

Lore generation uses variable transactions in two phases. Activation, recursive
scan, and budget previews use scratch contexts and never commit variable
changes. Kept lore summaries and bodies commit their variable mutations only
when they are formatted into prompt order. Budget checks are recomputed after
earlier prompt-order mutations, random lore is sampled only when kept text is
emitted, and dropped or macro-empty lore does not commit variables or start
timers.

Roleplay prompt preset sections resolve macros in final provider-message order
when the selected preset has sections. The `chat_history` marker anchors the
transcript and prompt preset depth sections, and sectioned presets include
transcript history only when that marker is enabled. Known Roleplay markers
expand scene, lore, persona, character, and example-dialogue blocks. Sectioned
presets that omit a non-depth lore marker do not emit that lore text, so no
prompt mutations from the omitted text commit. If enabled section/group
filtering leaves no materialized messages, Roleplay falls back to the selected
system prompt without transcript history. Messenger does not consume preset
sections; it continues to render its Messenger prompt source/system prompt path.

## Slice 7 Dynamic Variable Persistence

The resolver still treats variables as caller-owned context and never reads
storage. Messenger and Roleplay generation build a request-local variable map
from global `MacroVariableScope` state overlaid with the active thread scope,
then record committed prompt-order mutations for the caller.

Before prompt text resolves, selected prompt presets overlay static
`variableValues` and resolved per-thread `presetChoiceSelections` into the
request-local variable map, then resolve those preset-supplied variable values
once with a scratch macro context. Those preset variables can override stored
global or thread macro variables for the current request, but they are not
persisted in `macro-variable-states`. Mutations targeting those request-local
names can affect later prompt text in the same request, but they are ignored
when macro variable state is committed.
Mode generation commits macro mutations only after provider generation succeeds
and only while the originating user input still exists. Mutated keys update the
scope that supplied them at generation start: thread keys stay thread-scoped,
keys that existed only in global state stay global, and new keys are saved to
the thread scope. Deleting or clearing a thread removes its thread-scoped macro
variable state.

Legacy import can seed the same storage collection from old `globalVariables`
and Messenger thread `variables`. Import-time behavior does not change resolver
precedence: thread variables still overlay global variables during generation.
On commit, imported global keys merge into the current global scope with
imported values taking precedence for same-name keys, while imported thread
variables stay attached to their converted Messenger thread.

## Reserved Later Semantics

This macro family is intentionally not active yet. Until its slice lands,
matching spans follow the same unresolved-span rule as unknown macros: nested
active macros stay inert, except comment spans are still stripped and terminal
case post-processing can transform complete case blocks inside the unresolved
span.

- deferred character macro second-pass behavior for group scenarios, if prompt
  assembly later needs to resolve shared text before a target companion is known

Unsupported legacy or future macros such as `{{original}}` are not part of the
active catalog and should not be shown as insertable syntax.

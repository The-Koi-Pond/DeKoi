import type { CharacterMacroFields, MacroContext } from "./macro-types";

export type SupportedMacroCategory =
  "identity" | "character" | "context" | "time" | "formatting" | "control" | "random" | "variables";

export interface SupportedMacroCategoryInfo {
  id: SupportedMacroCategory;
  label: string;
}

export interface SupportedMacro {
  id: string;
  category: SupportedMacroCategory;
  syntax: string;
  insertText: string;
  description: string;
}

interface LiteralMacroDefinition extends SupportedMacro {
  kind: "literal";
  name: string;
}

interface PatternMacroDefinition extends SupportedMacro {
  kind: "pattern";
}

export interface IdentityMacroDefinition extends LiteralMacroDefinition {
  category: "identity";
  value: "user" | "char" | "characters" | "persona";
}

export interface CharacterFieldMacroDefinition extends LiteralMacroDefinition {
  category: "character";
  field: keyof CharacterMacroFields;
}

export interface ContextMacroDefinition extends LiteralMacroDefinition {
  category: "context";
  field: "chatId" | "idleDuration" | "lastGenerationType" | "lastInput" | "model";
}

export interface TimeMacroDefinition extends LiteralMacroDefinition {
  category: "time";
  value: "date" | "isotime" | "time" | "timezone" | "weekday";
}

export interface FormatLiteralMacroDefinition extends LiteralMacroDefinition {
  category: "formatting";
  value: "newline" | "trim" | "trimEnd" | "trimStart";
}

export interface ControlMacroDefinition extends LiteralMacroDefinition {
  category: "control";
  output: string;
}

export interface VariablePrefixDefinition extends PatternMacroDefinition {
  category: "variables";
  prefix: "addvar::" | "decvar::" | "getvar::" | "incvar::" | "setvar::";
}

export const SUPPORTED_MACRO_CATEGORIES = [
  { id: "identity", label: "Identity" },
  { id: "character", label: "Character" },
  { id: "context", label: "Context" },
  { id: "time", label: "Time" },
  { id: "formatting", label: "Formatting" },
  { id: "control", label: "Control" },
  { id: "random", label: "Random" },
  { id: "variables", label: "Variables" },
] as const satisfies readonly SupportedMacroCategoryInfo[];

export const IDENTITY_MACRO_DEFINITIONS = [
  {
    kind: "literal",
    id: "user",
    category: "identity",
    name: "user",
    value: "user",
    syntax: "{{user}}",
    insertText: "{{user}}",
    description: "Current user name.",
  },
  {
    kind: "literal",
    id: "user-name",
    category: "identity",
    name: "userName",
    value: "user",
    syntax: "{{userName}}",
    insertText: "{{userName}}",
    description: "Compatibility alias for the current user name.",
  },
  {
    kind: "literal",
    id: "char",
    category: "identity",
    name: "char",
    value: "char",
    syntax: "{{char}}",
    insertText: "{{char}}",
    description: "Selected companion name.",
  },
  {
    kind: "literal",
    id: "char-name",
    category: "identity",
    name: "charName",
    value: "char",
    syntax: "{{charName}}",
    insertText: "{{charName}}",
    description: "Compatibility alias for {{char}}.",
  },
  {
    kind: "literal",
    id: "characters",
    category: "identity",
    name: "characters",
    value: "characters",
    syntax: "{{characters}}",
    insertText: "{{characters}}",
    description: "All selected companion names, comma-separated.",
  },
  {
    kind: "literal",
    id: "persona",
    category: "identity",
    name: "persona",
    value: "persona",
    syntax: "{{persona}}",
    insertText: "{{persona}}",
    description: "Active persona name, or the user fallback.",
  },
] as const satisfies readonly IdentityMacroDefinition[];

const CHARACTER_FIELD_MACRO_ROWS = [
  ["display-name", "displayName", "Selected companion display name field."],
  ["nickname", "nickname", "Selected companion nickname field."],
  ["description", "description", "Selected companion description field."],
  ["personality", "personality", "Selected companion personality field."],
  ["scenario", "scenario", "Selected companion scenario field."],
  ["first-message", "firstMessage", "Selected companion first message field."],
  ["example-messages", "exampleMessages", "Selected companion example dialogue field."],
  ["system-prompt", "systemPrompt", "Selected companion system prompt field."],
  [
    "post-history-instructions",
    "postHistoryInstructions",
    "Selected companion post-history instructions field.",
  ],
  ["creator", "creator", "Selected companion creator field."],
  ["character-version", "characterVersion", "Selected companion version field."],
  ["creator-notes", "creatorNotes", "Selected companion creator notes field."],
  ["character-note", "characterNote", "Selected companion note field."],
] as const satisfies readonly [string, keyof CharacterMacroFields, string][];

export const CHARACTER_FIELD_MACRO_DEFINITIONS = CHARACTER_FIELD_MACRO_ROWS.map(
  ([id, field, description]) => ({
    kind: "literal" as const,
    id,
    category: "character" as const,
    name: field,
    field,
    syntax: `{{${field}}}`,
    insertText: `{{${field}}}`,
    description,
  }),
) satisfies readonly CharacterFieldMacroDefinition[];

const TIME_MACRO_ROWS = [
  ["time", "Current hour and minute in the macro time zone."],
  ["date", "Current long date in the macro time zone."],
  ["weekday", "Current weekday in the macro time zone."],
  ["isotime", "Current time as an ISO timestamp."],
  ["timezone", "Normalized macro time zone, or UTC."],
] as const satisfies readonly [TimeMacroDefinition["value"], string][];

export const TIME_MACRO_DEFINITIONS = TIME_MACRO_ROWS.map(([name, description]) => ({
  kind: "literal" as const,
  id: name,
  category: "time" as const,
  name,
  value: name,
  syntax: `{{${name}}}`,
  insertText: `{{${name}}}`,
  description,
})) satisfies readonly TimeMacroDefinition[];

export const CONTEXT_MACRO_DEFINITIONS = [
  {
    kind: "literal",
    id: "input",
    category: "context",
    name: "input",
    field: "lastInput",
    syntax: "{{input}}",
    insertText: "{{input}}",
    description: "Latest user or roleplay input for the generation pass.",
  },
  {
    kind: "literal",
    id: "model",
    category: "context",
    name: "model",
    field: "model",
    syntax: "{{model}}",
    insertText: "{{model}}",
    description: "Selected provider model.",
  },
  {
    kind: "literal",
    id: "chat-id",
    category: "context",
    name: "chatId",
    field: "chatId",
    syntax: "{{chatId}}",
    insertText: "{{chatId}}",
    description: "Current Messenger or Roleplay thread id.",
  },
  {
    kind: "literal",
    id: "last-generation-type",
    category: "context",
    name: "lastGenerationType",
    field: "lastGenerationType",
    syntax: "{{lastGenerationType}}",
    insertText: "{{lastGenerationType}}",
    description: "Generation kind supplied by the mode.",
  },
  {
    kind: "literal",
    id: "idle-duration",
    category: "context",
    name: "idle_duration",
    field: "idleDuration",
    syntax: "{{idle_duration}}",
    insertText: "{{idle_duration}}",
    description: "Formatted idle duration when supplied by the caller.",
  },
] as const satisfies readonly ContextMacroDefinition[];

export const FORMAT_LITERAL_MACRO_DEFINITIONS = [
  {
    kind: "literal",
    id: "newline",
    category: "formatting",
    name: "newline",
    value: "newline",
    syntax: "{{newline}}",
    insertText: "{{newline}}",
    description: "Newline character.",
  },
  {
    kind: "literal",
    id: "trim",
    category: "formatting",
    name: "trim",
    value: "trim",
    syntax: "{{trim}}",
    insertText: "{{trim}}",
    description: "Trim whitespace on both sides of the marker.",
  },
  {
    kind: "literal",
    id: "trim-start",
    category: "formatting",
    name: "trimStart",
    value: "trimStart",
    syntax: "{{trimStart}}",
    insertText: "{{trimStart}}",
    description: "Trim following whitespace.",
  },
  {
    kind: "literal",
    id: "trim-end",
    category: "formatting",
    name: "trimEnd",
    value: "trimEnd",
    syntax: "{{trimEnd}}",
    insertText: "{{trimEnd}}",
    description: "Trim preceding whitespace.",
  },
] as const satisfies readonly FormatLiteralMacroDefinition[];

const FORMAT_BLOCK_MACRO_DEFINITIONS = [
  {
    kind: "pattern",
    id: "uppercase",
    category: "formatting",
    syntax: "{{uppercase}}...{{/uppercase}}",
    insertText: "{{uppercase}}{{/uppercase}}",
    description: "Uppercase the resolved block body.",
  },
  {
    kind: "pattern",
    id: "lowercase",
    category: "formatting",
    syntax: "{{lowercase}}...{{/lowercase}}",
    insertText: "{{lowercase}}{{/lowercase}}",
    description: "Lowercase the resolved block body.",
  },
] as const satisfies readonly PatternMacroDefinition[];

export const CONTROL_MACRO_DEFINITIONS = [
  {
    kind: "literal",
    id: "noop",
    category: "control",
    name: "noop",
    output: "",
    syntax: "{{noop}}",
    insertText: "{{noop}}",
    description: "Render empty text.",
  },
  {
    kind: "literal",
    id: "banned",
    category: "control",
    name: "banned",
    output: "",
    syntax: "{{banned}}",
    insertText: "{{banned}}",
    description: "Render empty text.",
  },
] as const satisfies readonly ControlMacroDefinition[];

const STRUCTURAL_MACRO_DEFINITIONS = [
  {
    kind: "pattern",
    id: "comment",
    category: "control",
    syntax: "{{// comment}}",
    insertText: "{{// comment}}",
    description: "Comment removed before prompt text is sent.",
  },
  {
    kind: "pattern",
    id: "if",
    category: "control",
    syntax: "{{#if condition}}...{{else}}...{{/if}}",
    insertText: "{{#if condition}}{{else}}{{/if}}",
    description: "Choose text from a string condition.",
  },
] as const satisfies readonly PatternMacroDefinition[];

const RANDOM_MACRO_DEFINITIONS = [
  {
    kind: "literal",
    id: "random",
    category: "random",
    name: "random",
    syntax: "{{random}}",
    insertText: "{{random}}",
    description: "Random decimal in [0, 1).",
  },
  {
    kind: "pattern",
    id: "random-two-options",
    category: "random",
    syntax: "{{random:A:B}}",
    insertText: "{{random:A:B}}",
    description: "Choose one of two colon-separated options.",
  },
  {
    kind: "pattern",
    id: "random-options",
    category: "random",
    syntax: "{{random::A::B}}",
    insertText: "{{random::A::B}}",
    description: "Choose one double-colon-separated option.",
  },
  {
    kind: "pattern",
    id: "random-weighted",
    category: "random",
    syntax: "{{random::A@2::B@0.5}}",
    insertText: "{{random::A@2::B@0.5}}",
    description: "Choose from weighted options.",
  },
  {
    kind: "pattern",
    id: "roll",
    category: "random",
    syntax: "{{roll:2d6}}",
    insertText: "{{roll:2d6}}",
    description: "Roll dice and render the total.",
  },
] as const satisfies readonly (LiteralMacroDefinition | PatternMacroDefinition)[];

export const RANDOM_DOUBLE_COLON_PREFIX = "random::";
export const RANDOM_COLON_PREFIX = "random:";
export const ROLL_PREFIX = "roll:";

export const VARIABLE_PREFIX_DEFINITIONS = [
  {
    kind: "pattern",
    id: "getvar",
    category: "variables",
    prefix: "getvar::",
    syntax: "{{getvar::name}}",
    insertText: "{{getvar::name}}",
    description: "Read a request variable, or empty text when missing.",
  },
  {
    kind: "pattern",
    id: "setvar",
    category: "variables",
    prefix: "setvar::",
    syntax: "{{setvar::name::value}}",
    insertText: "{{setvar::name::value}}",
    description: "Set a request variable and render empty text.",
  },
  {
    kind: "pattern",
    id: "addvar",
    category: "variables",
    prefix: "addvar::",
    syntax: "{{addvar::name::delta}}",
    insertText: "{{addvar::name::delta}}",
    description: "Add a number to a request variable.",
  },
  {
    kind: "pattern",
    id: "incvar",
    category: "variables",
    prefix: "incvar::",
    syntax: "{{incvar::name}}",
    insertText: "{{incvar::name}}",
    description: "Add 1 to a request variable.",
  },
  {
    kind: "pattern",
    id: "decvar",
    category: "variables",
    prefix: "decvar::",
    syntax: "{{decvar::name}}",
    insertText: "{{decvar::name}}",
    description: "Subtract 1 from a request variable.",
  },
] as const satisfies readonly VariablePrefixDefinition[];

const VARIABLE_CATCHALL_MACRO_DEFINITION = {
  kind: "pattern",
  id: "variable-name",
  category: "variables",
  syntax: "{{name}}",
  insertText: "{{name}}",
  description: "Read an existing variable when no built-in macro matches.",
} as const satisfies PatternMacroDefinition;

export const SUPPORTED_MACRO_DEFINITIONS = [
  ...IDENTITY_MACRO_DEFINITIONS,
  ...CHARACTER_FIELD_MACRO_DEFINITIONS,
  ...CONTEXT_MACRO_DEFINITIONS,
  ...TIME_MACRO_DEFINITIONS,
  ...FORMAT_LITERAL_MACRO_DEFINITIONS,
  ...FORMAT_BLOCK_MACRO_DEFINITIONS,
  ...CONTROL_MACRO_DEFINITIONS,
  ...STRUCTURAL_MACRO_DEFINITIONS,
  ...RANDOM_MACRO_DEFINITIONS,
  ...VARIABLE_PREFIX_DEFINITIONS,
  VARIABLE_CATCHALL_MACRO_DEFINITION,
] as const;

export const KNOWN_NESTED_MACRO_PREFIXES = VARIABLE_PREFIX_DEFINITIONS.map(
  (definition) => definition.prefix,
);

export const KNOWN_NESTED_MACRO_NAMES = new Set([
  ...FORMAT_LITERAL_MACRO_DEFINITIONS.map((definition) => definition.name),
  "/trim",
  ...FORMAT_BLOCK_MACRO_DEFINITIONS.flatMap((definition) => [definition.id, `/${definition.id}`]),
  ...CONTROL_MACRO_DEFINITIONS.map((definition) => definition.name),
  "random",
]);

export function findLiteralMacroDefinition<Definition extends { kind: "literal"; name: string }>(
  definitions: readonly Definition[],
  name: string,
): Definition | null {
  return definitions.find((definition) => definition.name === name) ?? null;
}

export function readContextMacroField(
  context: MacroContext,
  field: ContextMacroDefinition["field"],
) {
  return context[field];
}

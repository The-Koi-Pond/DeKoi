import { applyBuiltins, renderUnknownMacro } from "./macro-builtins";
import { applyFormatPostProcessors } from "./macro-builtins/format-macros";
import { findMacroSpanClose, mapMacroSpans } from "./macro-spans";
import type { MacroContext, ResolveMacroOptions } from "./macro-types";

const MAX_CONDITION_BLOCK_DEPTH = 64;
const MAX_CONDITION_VALUE_PASSES = 16;
const STRUCTURAL_MACRO_TOKEN_PATTERN = /{{\s*(?:#if(?:\s|})|\/\/)/;

type ConditionOperator = "==" | "!=" | "is" | "contains" | "includes";

interface MacroSpanBoundary {
  body: string;
  end: number;
  start: number;
}

interface IfOpenToken extends MacroSpanBoundary {
  condition: string;
}

interface IfBlockMatch {
  close: MacroSpanBoundary;
  elseToken: MacroSpanBoundary | null;
}

interface ParsedCondition {
  left: string;
  malformed: boolean;
  operator: ConditionOperator | null;
  right: string;
}

interface StructuralMacroResult {
  exhausted: boolean;
  value: string;
}

interface MacroTextPassResult {
  exhausted: boolean;
  value: string;
}

interface MacroShieldState {
  prefix: string;
  values: string[];
}

type ConditionOperandResult =
  | {
      kind: "resolved";
      value: string;
    }
  | {
      kind: "unresolved";
    };

interface ConditionEvaluationResult {
  unresolved: boolean;
  value: boolean | null;
}

function isCommentBody(body: string) {
  return body.trimStart().startsWith("//");
}

function startsWithIfPrefix(body: string) {
  return body === "#if" || (body.startsWith("#if") && /\s/.test(body[3] ?? ""));
}

function readMacroSpan(input: string, start: number): MacroSpanBoundary | null {
  if (!input.startsWith("{{", start)) return null;

  const end = findMacroSpanClose(input, start);
  if (end === null) return null;

  return {
    body: input.slice(start + 2, end - 2),
    end,
    start,
  };
}

function readNextMacroSpan(input: string, startIndex: number) {
  const start = input.indexOf("{{", startIndex);
  if (start === -1) return { kind: "none" as const };

  const span = readMacroSpan(input, start);
  if (span === null) return { kind: "malformed" as const, start };

  return { kind: "span" as const, span };
}

function asIfOpenToken(span: MacroSpanBoundary): IfOpenToken | null {
  const body = span.body.trim();
  if (!startsWithIfPrefix(body)) return null;

  return {
    ...span,
    condition: body.slice(3).trim(),
  };
}

function findMatchingIfBlock(input: string, open: IfOpenToken): IfBlockMatch | null {
  let cursor = open.end;
  let depth = 1;
  let elseToken: MacroSpanBoundary | null = null;

  while (cursor < input.length) {
    const next = readNextMacroSpan(input, cursor);
    if (next.kind !== "span") return null;

    const body = next.span.body.trim();
    if (startsWithIfPrefix(body)) {
      depth += 1;
      if (depth > MAX_CONDITION_BLOCK_DEPTH) return null;
    } else if (body === "/if") {
      depth -= 1;
      if (depth === 0) return { close: next.span, elseToken };
    } else if (body === "else" && depth === 1 && elseToken === null) {
      elseToken = next.span;
    }

    cursor = next.span.end;
  }

  return null;
}

function isWordChar(value: string | undefined) {
  return value !== undefined && /^[A-Za-z0-9_]$/.test(value);
}

function hasWordBoundary(input: string, start: number, length: number) {
  return !isWordChar(input[start - 1]) && !isWordChar(input[start + length]);
}

function quoteCloseFor(value: string) {
  switch (value) {
    case '"':
    case "'":
      return value;
    case "\u201c":
      return "\u201d";
    case "\u2018":
      return "\u2019";
    default:
      return null;
  }
}

function skipQuotedSegment(input: string, start: number, closeQuote: string) {
  const close = input.indexOf(closeQuote, start + 1);
  return close === -1 ? input.length : close + closeQuote.length;
}

function findConditionOperator(input: string) {
  let cursor = 0;
  const wordOperators: ConditionOperator[] = ["contains", "includes", "is"];

  while (cursor < input.length) {
    if (input.startsWith("{{", cursor)) {
      const end = findMacroSpanClose(input, cursor);
      if (end === null) return { malformed: true as const };
      cursor = end;
      continue;
    }

    const closeQuote = quoteCloseFor(input[cursor] ?? "");
    if (closeQuote !== null) {
      cursor = skipQuotedSegment(input, cursor, closeQuote);
      continue;
    }

    if (input.startsWith("==", cursor)) {
      return { length: 2, operator: "==" as const, start: cursor };
    }

    if (input.startsWith("!=", cursor)) {
      return { length: 2, operator: "!=" as const, start: cursor };
    }

    for (const operator of wordOperators) {
      if (input.startsWith(operator, cursor) && hasWordBoundary(input, cursor, operator.length)) {
        return { length: operator.length, operator, start: cursor };
      }
    }

    cursor += 1;
  }

  return null;
}

function parseCondition(input: string): ParsedCondition {
  const operator = findConditionOperator(input);
  if (operator?.malformed === true) {
    return {
      left: input,
      malformed: true,
      operator: null,
      right: "",
    };
  }

  if (operator === null) {
    return {
      left: input,
      malformed: false,
      operator: null,
      right: "",
    };
  }

  return {
    left: input.slice(0, operator.start),
    malformed: false,
    operator: operator.operator,
    right: input.slice(operator.start + operator.length),
  };
}

function unwrapQuotedOperand(input: string) {
  const closeQuote = quoteCloseFor(input[0] ?? "");
  if (closeQuote === null || !input.endsWith(closeQuote)) return null;

  return input.slice(1, input.length - closeQuote.length);
}

function createMacroShieldState(input: string): MacroShieldState {
  let prefix = "\u0000_0_";
  let attempt = 0;

  while (input.includes(prefix)) {
    attempt += 1;
    prefix = `\u0000_${attempt}_`;
  }

  return { prefix, values: [] };
}

function shieldMacroText(input: string, shields: MacroShieldState) {
  const token = `${shields.prefix}${shields.values.length}\u0000`;
  shields.values.push(input);
  return token;
}

function restoreShieldedMacroText(input: string, shields: MacroShieldState) {
  let result = input;

  for (let index = 0; index < shields.values.length; index += 1) {
    result = result.split(`${shields.prefix}${index}\u0000`).join(shields.values[index] ?? "");
  }

  return result;
}

function shieldRemainingStructuralMacroText(input: string, shields: MacroShieldState): string {
  let result = "";
  let cursor = 0;

  while (cursor < input.length) {
    const next = readNextMacroSpan(input, cursor);
    if (next.kind === "none") {
      result += input.slice(cursor);
      break;
    }

    if (next.kind === "malformed") {
      result += input.slice(cursor);
      break;
    }

    result += input.slice(cursor, next.span.start);

    if (isCommentBody(next.span.body)) {
      result += shieldMacroText(input.slice(next.span.start, next.span.end), shields);
      cursor = next.span.end;
      continue;
    }

    const open = asIfOpenToken(next.span);
    if (open !== null) {
      const match = findMatchingIfBlock(input, open);
      if (match === null) {
        result += shieldMacroText(input.slice(next.span.start), shields);
        break;
      }

      result += shieldMacroText(input.slice(open.start, match.close.end), shields);
      cursor = match.close.end;
      continue;
    }

    result += `{{${shieldRemainingStructuralMacroText(next.span.body, shields)}}}`;
    cursor = next.span.end;
  }

  return result;
}

function applyFormatPostProcessorsWithStructuralShields(input: string) {
  const shields = createMacroShieldState(input);
  const shieldedInput = shieldRemainingStructuralMacroText(input, shields);

  return restoreShieldedMacroText(applyFormatPostProcessors(shieldedInput), shields);
}

function resolveStructuralMacroResult(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
  shields: MacroShieldState,
): StructuralMacroResult {
  if (!STRUCTURAL_MACRO_TOKEN_PATTERN.test(input)) {
    return { exhausted: false, value: input };
  }

  return resolveStructuralMacrosAtDepth(input, context, options, depth, shields);
}

function resolveMacroTextPass(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
): MacroTextPassResult {
  const shields = createMacroShieldState(input);
  const withStructuralMacros = resolveStructuralMacroResult(
    input,
    context,
    options,
    depth,
    shields,
  );
  const value = mapMacroSpans(withStructuralMacros.value, ({ body }) => {
    const replacement = applyBuiltins(body, context, options);
    return replacement ?? renderUnknownMacro(body);
  });

  return {
    exhausted: withStructuralMacros.exhausted,
    value: restoreShieldedMacroText(value, shields),
  };
}

function resolveMacroText(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
): ConditionOperandResult {
  let result = input;

  for (let pass = 0; pass < MAX_CONDITION_VALUE_PASSES; pass += 1) {
    const next = resolveMacroTextPass(result, context, options, depth);
    if (next.exhausted) return { kind: "unresolved" };
    if (next.value === result) {
      return {
        kind: "resolved",
        value: applyFormatPostProcessorsWithStructuralShields(next.value),
      };
    }
    result = next.value;
  }

  const stableAfterFinalPass = resolveMacroTextPass(result, context, options, depth);
  if (stableAfterFinalPass.exhausted) return { kind: "unresolved" };
  if (stableAfterFinalPass.value === result) {
    return { kind: "resolved", value: applyFormatPostProcessorsWithStructuralShields(result) };
  }

  return { kind: "unresolved" };
}

function resolveConditionOperand(
  rawOperand: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
): ConditionOperandResult {
  const operand = rawOperand.trim();
  if (operand === "") return { kind: "resolved", value: "" };

  const quotedOperand = unwrapQuotedOperand(operand);
  if (quotedOperand !== null) return resolveMacroText(quotedOperand, context, options, depth);

  if (operand.includes("{{")) return resolveMacroText(operand, context, options, depth);

  const directReplacement = applyBuiltins(operand, context, options);
  if (directReplacement !== null) {
    return resolveMacroText(directReplacement, context, options, depth);
  }

  return { kind: "resolved", value: operand };
}

function evaluateCondition(
  condition: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
): ConditionEvaluationResult {
  const parsed = parseCondition(condition);
  if (parsed.malformed) return { unresolved: false, value: null };

  const left = resolveConditionOperand(parsed.left, context, options, depth);
  if (left.kind === "unresolved") return { unresolved: true, value: null };
  if (parsed.operator === null) {
    return { unresolved: false, value: left.value.trim().length > 0 };
  }

  const right = resolveConditionOperand(parsed.right, context, options, depth);
  if (right.kind === "unresolved") return { unresolved: true, value: null };

  switch (parsed.operator) {
    case "==":
    case "is":
      return { unresolved: false, value: left.value === right.value };
    case "!=":
      return { unresolved: false, value: left.value !== right.value };
    case "contains":
    case "includes":
      return { unresolved: false, value: left.value.includes(right.value) };
    default:
      return { unresolved: false, value: false };
  }
}

function resolveStructuralMacrosAtDepth(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
  shields: MacroShieldState,
): StructuralMacroResult {
  if (depth >= MAX_CONDITION_BLOCK_DEPTH) {
    return { exhausted: true, value: shieldMacroText(input, shields) };
  }

  let result = "";
  let cursor = 0;
  let exhausted = false;

  while (cursor < input.length) {
    const next = readNextMacroSpan(input, cursor);
    if (next.kind === "none") {
      result += input.slice(cursor);
      break;
    }

    if (next.kind === "malformed") {
      result += input.slice(cursor);
      break;
    }

    result += input.slice(cursor, next.span.start);

    if (isCommentBody(next.span.body)) {
      cursor = next.span.end;
      continue;
    }

    const open = asIfOpenToken(next.span);
    if (open === null) {
      const body = resolveStructuralMacrosAtDepth(
        next.span.body,
        context,
        options,
        depth + 1,
        shields,
      );
      exhausted = exhausted || body.exhausted;
      result += `{{${body.value}}}`;
      cursor = next.span.end;
      continue;
    }

    const match = findMatchingIfBlock(input, open);
    if (match === null) {
      result += shieldMacroText(input.slice(next.span.start), shields);
      break;
    }

    const truthyContent = input.slice(open.end, match.elseToken?.start ?? match.close.start);
    const falsyContent =
      match.elseToken === null ? "" : input.slice(match.elseToken.end, match.close.start);
    const conditionResult = evaluateCondition(open.condition, context, options, depth + 1);
    exhausted = exhausted || conditionResult.unresolved;
    if (conditionResult.value === null) {
      result += shieldMacroText(input.slice(open.start, match.close.end), shields);
      cursor = match.close.end;
      continue;
    }

    const selectedContent = conditionResult.value ? truthyContent : falsyContent;

    const selected = resolveStructuralMacrosAtDepth(
      selectedContent,
      context,
      options,
      depth + 1,
      shields,
    );
    exhausted = exhausted || selected.exhausted;
    result += selected.value;
    cursor = match.close.end;
  }

  return { exhausted, value: result };
}

export function resolveMacroPassWithStructuralMacros(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
) {
  return resolveMacroTextPass(input, context, options, 0).value;
}

export function applyFinalFormatPostProcessors(input: string) {
  return applyFormatPostProcessorsWithStructuralShields(input);
}

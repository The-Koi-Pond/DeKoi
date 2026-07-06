import { applyBuiltins, renderUnknownMacro } from "./macro-builtins";
import { applyFormatPostProcessors } from "./macro-builtins/format-macros";
import { isRandomOptionMacroName, resolveRandomMacro } from "./macro-builtins/random-macros";
import { isValidVariableName } from "./macro-builtins/variable-macros";
import { findMacroSpanClose, mapMacroSpans, type MacroSpan } from "./macro-spans";
import { restoreMacroState, snapshotMacroState } from "./macro-state";
import type { MacroContext, ResolveMacroOptions } from "./macro-types";

const MAX_CONDITION_BLOCK_DEPTH = 64;
const MAX_CONDITION_VALUE_PASSES = 16;
const MAX_INLINE_MACRO_REPLACEMENT_DEPTH = MAX_CONDITION_VALUE_PASSES;
const STRUCTURAL_MACRO_TOKEN_PATTERN = /{{\s*(?:#if(?:\s|})|\/\/)/;
const KNOWN_NESTED_MACRO_PREFIXES = ["addvar::", "decvar::", "getvar::", "incvar::", "setvar::"];
const KNOWN_NESTED_MACRO_NAMES = new Set([
  "/lowercase",
  "/trim",
  "/uppercase",
  "lowercase",
  "random",
  "trim",
  "uppercase",
]);

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

export interface MacroTextPassResult {
  exhausted: boolean;
  overflowed: boolean;
  value: string;
}

export interface MacroShieldState {
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

function shouldResolveMacroBody(body: string) {
  const name = body.trim();
  if (name === "") return true;
  if (isRandomOptionMacroName(name) || name.startsWith("roll:")) return true;
  if (KNOWN_NESTED_MACRO_NAMES.has(name)) return true;
  if (KNOWN_NESTED_MACRO_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;
  if (startsWithIfPrefix(name) || name === "else" || name === "/if") return true;
  return !name.includes("{{");
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

function isWhitespace(value: string | undefined) {
  return value !== undefined && /\s/.test(value);
}

function isVariableNameCharacter(value: string | undefined) {
  return value !== undefined && /[A-Za-z0-9_-]/.test(value);
}

function hasWordOperatorDelimiter(input: string, start: number, length: number) {
  const before = input[start - 1];
  const after = input[start + length];
  return isWhitespace(before) && after !== undefined && !isVariableNameCharacter(after);
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
      if (
        input.startsWith(operator, cursor) &&
        hasWordOperatorDelimiter(input, cursor, operator.length)
      ) {
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

export function createMacroPassShields(input: string): MacroShieldState {
  return createMacroShieldState(input);
}

function shieldMacroText(input: string, shields: MacroShieldState) {
  const token = `${shields.prefix}${shields.values.length}\u0000`;
  shields.values.push(input);
  return token;
}

export function restoreMacroPassShields(input: string, shields: MacroShieldState) {
  let result = input;

  for (let index = 0; index < shields.values.length; index += 1) {
    result = result.split(`${shields.prefix}${index}\u0000`).join(shields.values[index] ?? "");
  }

  return result;
}

function restoreShieldedMacroText(input: string, shields: MacroShieldState) {
  return restoreMacroPassShields(input, shields);
}

function shieldResolvedMacroText(input: string, shields: MacroShieldState) {
  return shieldMacroText(restoreShieldedMacroText(input, shields), shields);
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
  previewTail: string,
): StructuralMacroResult {
  if (!STRUCTURAL_MACRO_TOKEN_PATTERN.test(input)) {
    return { exhausted: false, value: input };
  }

  return resolveStructuralMacrosAtDepth(
    input,
    context,
    options,
    depth,
    shields,
    false,
    previewTail,
  );
}

function resolveMacroTextPass(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
  passShields: MacroShieldState | null = null,
  inlineDepth = 0,
  previewTail = "",
): MacroTextPassResult {
  const shields = passShields ?? createMacroShieldState(input);
  const withStructuralMacros = resolveStructuralMacroResult(
    input,
    context,
    options,
    depth,
    shields,
    previewTail,
  );

  let randomOptionExhausted = false;
  let replacementExhausted = false;
  let replacementOverflowed = false;

  function resolveReplacementText(value: string, tail: string): string {
    if (!value.includes("{{")) return value;

    const resolved = resolveMacroTextInline(
      value,
      context,
      options,
      depth + 1,
      shields,
      inlineDepth + 1,
      tail,
    );
    replacementExhausted = replacementExhausted || resolved.exhausted;
    replacementOverflowed = replacementOverflowed || resolved.overflowed;
    return resolved.value;
  }

  function resolveRandomSpan(span: MacroSpan) {
    return resolveRandomMacro(span.body.trim(), options, (value, randomOption) => {
      const commit = randomOption?.commit !== false;
      const stateBeforePreview = commit ? null : snapshotMacroState(context);
      const selected = resolveMacroTextInline(
        value,
        context,
        options,
        depth + 1,
        shields,
        inlineDepth + 1,
      );
      const tail = span.source.slice(span.end) + previewTail;
      const previewTailResult =
        stateBeforePreview && options.randomSelection === "longest" && tail
          ? resolveMacroTextInline(tail, context, options, depth, shields, inlineDepth + 1, "")
          : null;
      if (stateBeforePreview) {
        restoreMacroState(context, stateBeforePreview);
      }
      if (commit) {
        randomOptionExhausted = randomOptionExhausted || selected.exhausted;
        replacementOverflowed = replacementOverflowed || selected.overflowed;
      }
      const previewValue = previewTailResult
        ? selected.value + previewTailResult.value
        : selected.value;
      return commit ? previewValue : restoreShieldedMacroText(previewValue, shields);
    });
  }

  function resolveMacroSpan({ body, end, source }: MacroSpan) {
    const replacement = applyBuiltins(body, context, options);
    return replacement === null
      ? renderUnknownMacro(body)
      : resolveReplacementText(replacement, source.slice(end) + previewTail);
  }

  const value = mapMacroSpans(withStructuralMacros.value, resolveMacroSpan, {
    replaceRawMacro: resolveRandomSpan,
    resolveBody: (span) => shouldResolveMacroBody(span.body),
  });

  return {
    exhausted: withStructuralMacros.exhausted || randomOptionExhausted || replacementExhausted,
    overflowed: replacementOverflowed,
    value: passShields ? value : restoreShieldedMacroText(value, shields),
  };
}

function resolveMacroTextInline(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
  shields: MacroShieldState,
  inlineDepth: number,
  previewTail = "",
): MacroTextPassResult {
  if (inlineDepth > MAX_INLINE_MACRO_REPLACEMENT_DEPTH) {
    return { exhausted: true, overflowed: true, value: input };
  }

  const stateBeforeInput = snapshotMacroState(context);
  let result = input;
  let exhausted = false;

  const rollbackExhaustedResult = (value: string): MacroTextPassResult => {
    restoreMacroState(context, stateBeforeInput);
    return {
      exhausted: true,
      overflowed: false,
      value: shieldResolvedMacroText(value, shields),
    };
  };

  for (let pass = 0; pass < MAX_CONDITION_VALUE_PASSES; pass += 1) {
    const next = resolveMacroTextPass(
      result,
      context,
      options,
      depth,
      shields,
      inlineDepth,
      previewTail,
    );
    exhausted = exhausted || next.exhausted;
    if (next.overflowed) {
      restoreMacroState(context, stateBeforeInput);
      return { exhausted: true, overflowed: true, value: input };
    }
    if (next.value === result) {
      return exhausted
        ? rollbackExhaustedResult(result)
        : { exhausted: false, overflowed: false, value: result };
    }
    result = next.value;
  }

  const stableAfterFinalPass = resolveMacroTextPass(
    result,
    context,
    options,
    depth,
    shields,
    inlineDepth,
    previewTail,
  );
  exhausted = exhausted || stableAfterFinalPass.exhausted;
  if (!stableAfterFinalPass.overflowed && stableAfterFinalPass.value === result) {
    return exhausted
      ? rollbackExhaustedResult(result)
      : { exhausted: false, overflowed: false, value: result };
  }

  restoreMacroState(context, stateBeforeInput);
  return { exhausted: true, overflowed: true, value: input };
}

function resolveMacroText(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
  previewTail = "",
): ConditionOperandResult {
  let result = input;

  for (let pass = 0; pass < MAX_CONDITION_VALUE_PASSES; pass += 1) {
    const next = resolveMacroTextPass(result, context, options, depth, null, 0, previewTail);
    if (next.exhausted || next.overflowed) return { kind: "unresolved" };
    if (next.value === result) {
      return {
        kind: "resolved",
        value: applyFormatPostProcessorsWithStructuralShields(next.value),
      };
    }
    result = next.value;
  }

  const stableAfterFinalPass = resolveMacroTextPass(
    result,
    context,
    options,
    depth,
    null,
    0,
    previewTail,
  );
  if (stableAfterFinalPass.exhausted || stableAfterFinalPass.overflowed) {
    return { kind: "unresolved" };
  }
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
  previewTail: string,
  missingBareVariableValue: string | null = null,
): ConditionOperandResult {
  const operand = rawOperand.trim();
  if (operand === "") return { kind: "resolved", value: "" };

  const quotedOperand = unwrapQuotedOperand(operand);
  if (quotedOperand !== null)
    return resolveMacroText(quotedOperand, context, options, depth, previewTail);

  if (operand.includes("{{"))
    return resolveMacroText(operand, context, options, depth, previewTail);

  const directReplacement = applyBuiltins(operand, context, options);
  if (directReplacement !== null) {
    return resolveMacroText(directReplacement, context, options, depth, previewTail);
  }

  if (missingBareVariableValue !== null && isValidVariableName(operand)) {
    return { kind: "resolved", value: missingBareVariableValue };
  }

  return { kind: "resolved", value: operand };
}

function isMissingBareVariableReference(operand: string, context: MacroContext) {
  if (!isValidVariableName(operand)) return false;
  return Object.prototype.hasOwnProperty.call(context.variables, operand);
}

function evaluateCondition(
  condition: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  depth: number,
  previewTail: string,
): ConditionEvaluationResult {
  const parsed = parseCondition(condition);
  if (parsed.malformed) return { unresolved: false, value: null };

  const leftMissingBareVariableValue = isMissingBareVariableReference(parsed.left.trim(), context)
    ? ""
    : null;
  const left = resolveConditionOperand(
    parsed.left,
    context,
    options,
    depth,
    previewTail,
    leftMissingBareVariableValue,
  );
  if (left.kind === "unresolved") return { unresolved: true, value: null };
  if (parsed.operator === null) {
    return { unresolved: false, value: left.value.trim().length > 0 };
  }

  const right = resolveConditionOperand(parsed.right, context, options, depth, previewTail);
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
  rollbackScopeOnExhaustion: boolean,
  previewTail: string,
): StructuralMacroResult {
  if (depth >= MAX_CONDITION_BLOCK_DEPTH) {
    return { exhausted: true, value: shieldMacroText(input, shields) };
  }

  const stateBeforeInput = rollbackScopeOnExhaustion ? snapshotMacroState(context) : null;
  let result = "";
  let cursor = 0;
  let exhausted = false;

  const restoreExhaustedScope = (fallback: ReturnType<typeof snapshotMacroState>) => {
    restoreMacroState(context, stateBeforeInput ?? fallback);
  };

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
      if (isRandomOptionMacroName(next.span.body.trim())) {
        result += input.slice(next.span.start, next.span.end);
        cursor = next.span.end;
        continue;
      }

      const stateBeforeSpan = snapshotMacroState(context);
      const body = resolveStructuralMacrosAtDepth(
        next.span.body,
        context,
        options,
        depth + 1,
        shields,
        rollbackScopeOnExhaustion,
        input.slice(next.span.end) + previewTail,
      );
      exhausted = exhausted || body.exhausted;
      if (body.exhausted) {
        restoreExhaustedScope(stateBeforeSpan);
        result += shieldMacroText(input.slice(next.span.start, next.span.end), shields);
      } else {
        result += `{{${body.value}}}`;
      }
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
    const blockTail = input.slice(match.close.end) + previewTail;
    const stateBeforeIf = snapshotMacroState(context);
    const conditionResult = evaluateCondition(
      open.condition,
      context,
      options,
      depth + 1,
      input.slice(open.end, match.close.end) + blockTail,
    );
    exhausted = exhausted || conditionResult.unresolved;
    if (conditionResult.value === null) {
      if (conditionResult.unresolved) {
        restoreExhaustedScope(stateBeforeIf);
      }
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
      true,
      blockTail,
    );
    exhausted = exhausted || selected.exhausted;
    if (selected.exhausted) {
      restoreExhaustedScope(stateBeforeIf);
      result += shieldResolvedMacroText(selected.value, shields);
    } else {
      result += selected.value;
    }
    cursor = match.close.end;
  }

  return { exhausted, value: result };
}

export function resolveMacroPassWithStructuralMacros(
  input: string,
  context: MacroContext,
  options: ResolveMacroOptions,
  passShields?: MacroShieldState,
) {
  return resolveMacroTextPass(input, context, options, 0, passShields ?? null);
}

export function applyFinalFormatPostProcessors(input: string) {
  return applyFormatPostProcessorsWithStructuralShields(input);
}

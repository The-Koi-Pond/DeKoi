import { findMacroSpanClose } from "../macro-spans";

const MAX_CASE_BLOCK_DEPTH = 64;
const TRIM_MARKER = "\x00DEKOI_MACRO_TRIM\x00";
const TRIM_START_MARKER = "\x00DEKOI_MACRO_TRIM_START\x00";
const TRIM_END_MARKER = "\x00DEKOI_MACRO_TRIM_END\x00";
// Reserved internal sentinels: resolved macro content must not intentionally emit these bytes.
const TRIM_MARKER_PATTERN = new RegExp(`\\s*${TRIM_MARKER}\\s*`, "g");
const TRIM_START_MARKER_PATTERN = new RegExp(`${TRIM_START_MARKER}\\s*`, "g");
const TRIM_END_MARKER_PATTERN = new RegExp(`\\s*${TRIM_END_MARKER}`, "g");

interface FormatBlockToken {
  type: "open" | "close";
  name: "uppercase" | "lowercase";
  start: number;
  end: number;
}

interface MacroSpanBoundary {
  start: number;
  end: number;
}

function createFormatBlockTokenPattern() {
  return /{{\s*(\/?)(uppercase|lowercase)\s*}}/g;
}

function findNextBlockOpen(input: string, startIndex: number): FormatBlockToken | null {
  const tokens = createFormatBlockTokenPattern();
  tokens.lastIndex = startIndex;

  for (let match = tokens.exec(input); match !== null; match = tokens.exec(input)) {
    if (match[1] === "/") continue;

    return {
      type: "open",
      name: match[2] as FormatBlockToken["name"],
      start: match.index,
      end: match.index + match[0].length,
    };
  }

  return null;
}

function findEnclosingMacroSpan(input: string, token: FormatBlockToken): MacroSpanBoundary | null {
  let boundary: MacroSpanBoundary | null = null;
  let searchStart = 0;
  let searchEnd = input.length;

  while (searchStart < searchEnd) {
    let cursor = searchStart;
    let nextBoundary: MacroSpanBoundary | null = null;

    while (cursor < searchEnd) {
      const start = input.indexOf("{{", cursor);
      if (start === -1 || start >= searchEnd) return boundary;

      const end = findMacroSpanClose(input, start);
      if (end === null || end > searchEnd) return boundary;

      if (start < token.start && token.end <= end) {
        nextBoundary = { start, end };
        break;
      }

      cursor = end;
    }

    if (nextBoundary === null) return boundary;

    boundary = nextBoundary;
    searchStart = nextBoundary.start + 2;
    searchEnd = nextBoundary.end - 2;
  }

  return boundary;
}

function isSameMacroBoundary(left: MacroSpanBoundary | null, right: MacroSpanBoundary | null) {
  return left?.start === right?.start && left?.end === right?.end;
}

function findMatchingBlockClose(input: string, open: FormatBlockToken): FormatBlockToken | null {
  const stack: FormatBlockToken["name"][] = [open.name];
  const boundary = findEnclosingMacroSpan(input, open);
  const tokens = createFormatBlockTokenPattern();
  tokens.lastIndex = open.end;

  for (let match = tokens.exec(input); match !== null; match = tokens.exec(input)) {
    const name = match[2] as FormatBlockToken["name"];

    const token: FormatBlockToken = {
      type: match[1] === "/" ? "close" : "open",
      name,
      start: match.index,
      end: match.index + match[0].length,
    };

    if (!isSameMacroBoundary(boundary, findEnclosingMacroSpan(input, token))) continue;

    if (token.type === "open") {
      stack.push(token.name);
      if (stack.length > MAX_CASE_BLOCK_DEPTH) return null;
      continue;
    }

    if (stack.at(-1) !== token.name) return null;

    stack.pop();
    if (stack.length === 0) return token;
  }

  return null;
}

function applyCaseBlock(name: FormatBlockToken["name"], value: string) {
  return name === "uppercase" ? value.toUpperCase() : value.toLowerCase();
}

interface CaseBlockResult {
  value: string;
  overDepth: boolean;
}

function applyCaseBlocksWithDepth(input: string, depth: number): CaseBlockResult {
  if (depth >= MAX_CASE_BLOCK_DEPTH) return { value: input, overDepth: true };

  let result = "";
  let cursor = 0;

  while (cursor < input.length) {
    const open = findNextBlockOpen(input, cursor);
    if (open === null) {
      result += input.slice(cursor);
      break;
    }

    const close = findMatchingBlockClose(input, open);
    if (close === null) {
      result += input.slice(cursor);
      break;
    }

    result += input.slice(cursor, open.start);

    const body = applyCaseBlocksWithDepth(input.slice(open.end, close.start), depth + 1);
    if (body.overDepth) return { value: input, overDepth: true };

    result += applyCaseBlock(open.name, body.value);
    cursor = close.end;
  }

  return { value: result, overDepth: false };
}

function applyCaseBlocks(input: string): string {
  return applyCaseBlocksWithDepth(input, 0).value;
}

function findMalformedMacroTailStart(input: string) {
  let cursor = 0;

  while (cursor < input.length) {
    const start = input.indexOf("{{", cursor);
    if (start === -1) return null;

    const end = findMacroSpanClose(input, start);
    if (end === null) return start;

    cursor = end;
  }

  return null;
}

function applyCaseBlocksBeforeMalformedTail(input: string) {
  const malformedStart = findMalformedMacroTailStart(input);
  if (malformedStart === null) return applyCaseBlocks(input);

  return applyCaseBlocks(input.slice(0, malformedStart)) + input.slice(malformedStart);
}

function applyTrimMarkers(input: string) {
  return input
    .replace(TRIM_MARKER_PATTERN, "")
    .replace(TRIM_START_MARKER_PATTERN, "")
    .replace(TRIM_END_MARKER_PATTERN, "");
}

export function resolveFormatMacro(name: string) {
  switch (name) {
    case "newline":
      return "\n";
    case "trim":
      return TRIM_MARKER;
    case "trimStart":
      return TRIM_START_MARKER;
    case "trimEnd":
      return TRIM_END_MARKER;
    default:
      return null;
  }
}

export function applyFormatPostProcessors(input: string) {
  return applyCaseBlocksBeforeMalformedTail(applyTrimMarkers(input));
}
